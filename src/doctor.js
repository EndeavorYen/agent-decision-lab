import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dirtyPathsOutsideLab, git } from './git.js';

export async function runDoctor(repoPath) {
  const checks = [];
  const gitRoot = git(repoPath, ['rev-parse', '--show-toplevel'], { allowFailure: true });
  const isGitRepo = gitRoot.status === 0;

  checks.push(check(
    'git-repository',
    'Git repository',
    isGitRepo ? 'ok' : 'fail',
    isGitRepo ? `root ${gitRoot.stdout.trim()}` : 'run ADL inside a Git repository',
  ));

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push(check(
    'node-version',
    'Node version',
    nodeMajor >= 22 ? 'ok' : 'fail',
    `current ${process.versions.node}; required >=22`,
  ));

  const labInitialized = await exists(join(repoPath, '.agent-lab', 'config.json'));
  checks.push(check(
    'adl-experiment',
    'ADL experiment',
    labInitialized ? 'ok' : 'warn',
    labInitialized ? 'current experiment metadata found' : 'run adl init or adl case-study init',
  ));

  const ignoresLab = await gitignoreContainsLab(repoPath);
  checks.push(check(
    'private-lab-ignore',
    'Private lab ignore',
    ignoresLab ? 'ok' : 'warn',
    ignoresLab ? '.agent-lab/ is ignored' : 'add .agent-lab/ to .gitignore unless this target intentionally tracks lab data',
  ));

  if (isGitRepo) {
    const dirty = dirtyPathsOutsideLab(repoPath);
    checks.push(check(
      'dirty-files-outside-lab',
      'Dirty files outside lab',
      dirty.length === 0 ? 'ok' : 'warn',
      dirty.length === 0 ? 'working tree has no non-lab changes' : dirty.join(', '),
    ));
  }

  return {
    ok: checks.every((item) => item.status !== 'fail'),
    checks,
  };
}

export function formatDoctorReport(report) {
  const lines = ['Agent Decision Lab Doctor', ''];
  for (const item of report.checks) {
    lines.push(`${item.label}: ${item.status} - ${item.message}`);
  }
  lines.push('', report.ok ? 'Result: ok' : 'Result: fail', '');
  return lines.join('\n');
}

function check(id, label, status, message) {
  return { id, label, status, message };
}

async function gitignoreContainsLab(repoPath) {
  const ignored = git(repoPath, ['check-ignore', '.agent-lab/probe'], { allowFailure: true });
  if (ignored.status === 0) {
    return true;
  }

  try {
    const body = await readFile(join(repoPath, '.gitignore'), 'utf8');
    return body.split('\n').some((line) => line.trim() === '.agent-lab/');
  } catch {
    return false;
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
