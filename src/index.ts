'use strict';

import * as core from '@actions/core';
import * as io from '@actions/io';
import * as utils from  "./utils";

async function installGitRemoteHg(dir: string) {
    const gitPath = await io.which('git', true);
    const pipPath = await io.which('pip', true);

    await utils.execOut(pipPath, ['install', 'mercurial==5.3.2', '--user'], false, '');

    const repoPath = `${dir}/git-remote-hg`;
    await io.mkdirP(repoPath);

    await utils.execOut(
        gitPath,
        ['clone', 'https://github.com/mozillazg/git-remote-hg.git', '-b', 'pypy', '--depth', '1', repoPath],
        false, '',
        );

    const chmodPath = await io.which('chmod', true);
    const toolPath = `${repoPath}/git-remote-hg`;
    await utils.execOut(chmodPath, ['+x', `${toolPath}`], false, '');
    await io.cp(toolPath, '/usr/local/bin/git-remote-hg', { recursive: false, force: false });

    return `${repoPath}/track_all_remote_branches.py`;
}

async function mirrorHgRepo(dir: string, hgURL: string, gitURL: string, trackTool: string) {
    const gitPath = await io.which('git', true);
    const pythonPath = await io.which('python', true);
    const bashPath = await io.which('bash', true);
    const repoPath = `${dir}/hg_repo`;
    await io.mkdirP(repoPath);

    await utils.execOut(gitPath, ['clone', `hg::${hgURL}`, repoPath], false, dir);
    await utils.execOut(gitPath, ['config', 'core.notesRef', 'refs/notes/hg'], false, repoPath);
    await utils.execOut(
        bashPath,
        ['-c', 'for remote in `git branch|grep -v \'\\* master\'`; do git branch -d $remote; done'],
        false, repoPath);
    await utils.execOut(pythonPath, [trackTool], false, repoPath);

    await utils.execOut(gitPath, ['pull'], false, repoPath);
    await utils.execOut(gitPath, ['reset', '--hard', 'default'], false, repoPath);

    await utils.execOut(gitPath, ['push', gitURL, '--all'], false, repoPath);
    await utils.execOut(gitPath, ['push', gitURL, '--tags'], false, repoPath);
}

async function main() {
    const hgRepoURL = core.getInput('source-hg-repo-url', { required: true });
    // const gitDomain = core.getInput('destination-git-domain', { required: false });
    // const gitScheme = core.getInput('destination-git-scheme', { required: false });
    const gitDomain = 'github.com';
    const gitScheme = 'https';
    const gitRepoOwner = core.getInput('destination-git-repo-owner', { required: true });
    const gitRepoName = core.getInput('destination-git-repo-name', { required: true });
    const gitToken = core.getInput('destination-git-personal-token', { required: true });
    core.setSecret(gitToken);
    const gitRepoURL = `https://${gitRepoOwner}:${gitToken}@github.com/${gitRepoOwner}/${gitRepoName}.git`;

    const tmpDir = await utils.execOut('mktemp', ['-d'], true, '');
    const trackTool = await installGitRemoteHg(tmpDir);
    await mirrorHgRepo(tmpDir, hgRepoURL, gitRepoURL, trackTool);
}

main();
