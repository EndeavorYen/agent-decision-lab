import { spawnSync } from 'node:child_process';

export function git(repoPath, args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repoPath,
    encoding: 'utf8',
  });

  if (!options.allowFailure && result.status !== 0) {
    throw new Error(
      [
        `git ${args.join(' ')} failed with status ${result.status}`,
        result.stdout,
        result.stderr,
      ].filter(Boolean).join('\n'),
    );
  }

  return result;
}

export function getRepoMetadata(repoPath) {
  const root = git(repoPath, ['rev-parse', '--show-toplevel']).stdout.trim();
  const remoteResult = git(repoPath, ['config', '--get', 'remote.origin.url'], {
    allowFailure: true,
  });
  const branchResult = git(repoPath, ['branch', '--show-current'], {
    allowFailure: true,
  });

  return {
    path: root,
    remote: remoteResult.status === 0 ? remoteResult.stdout.trim() || null : null,
    baseRef: branchResult.stdout.trim() || 'HEAD',
    baseCommit: git(repoPath, ['rev-parse', 'HEAD']).stdout.trim(),
  };
}

export function getCurrentCommit(repoPath, ref = 'HEAD') {
  return git(repoPath, ['rev-parse', ref]).stdout.trim();
}

export function branchExists(repoPath, branch) {
  return git(repoPath, ['rev-parse', '--verify', `refs/heads/${branch}`], {
    allowFailure: true,
  }).status === 0;
}

export function createBranch(repoPath, branch, startPoint) {
  if (branchExists(repoPath, branch)) {
    throw new Error(`Branch already exists: ${branch}`);
  }
  git(repoPath, ['branch', branch, startPoint]);
}

export function createWorktree(repoPath, worktreePath, branch, startPoint) {
  if (branchExists(repoPath, branch)) {
    git(repoPath, ['worktree', 'add', worktreePath, branch]);
  } else {
    git(repoPath, ['worktree', 'add', '-b', branch, worktreePath, startPoint]);
  }
}

export function dirtyPathsOutsideLab(repoPath) {
  const result = git(repoPath, ['status', '--porcelain', '--untracked-files=all']);
  return result.stdout
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3))
    .map((path) => path.includes(' -> ') ? path.split(' -> ').at(-1) : path)
    .filter((path) => path !== '.agent-lab' && !path.startsWith('.agent-lab/'));
}
