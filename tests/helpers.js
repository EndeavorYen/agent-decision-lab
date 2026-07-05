import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export const adlBin = join(projectRoot, 'bin/adl.js');

export async function createTempGitRepo() {
  const repo = await mkdtemp(join(tmpdir(), 'adl-test-'));
  run('git', ['init', '-b', 'main'], repo);
  run('git', ['config', 'user.email', 'test@example.invalid'], repo);
  run('git', ['config', 'user.name', 'ADL Test'], repo);
  await writeFile(join(repo, 'README.md'), '# Synthetic Test Repo\n');
  run('git', ['add', 'README.md'], repo);
  run('git', ['commit', '-m', 'initial commit'], repo);
  return repo;
}

export async function cleanup(path) {
  await rm(resolve(path, '..', `${basename(path)}-agent-lab`), {
    recursive: true,
    force: true,
  });
  await rm(path, { recursive: true, force: true });
}

export function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    input: options.input,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
  });
  if (options.allowFailure) {
    return result;
  }
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(' ')} failed with status ${result.status}`,
        result.stdout,
        result.stderr,
      ].filter(Boolean).join('\n'),
    );
  }
  return result;
}

export function runAdl(repo, args, options = {}) {
  return run(process.execPath, [adlBin, ...args], repo, options);
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
