import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';
import { closestOption } from '../src/command-contracts.js';

test('rejects an unknown option before variant side effects and suggests the supported flag', async () => {
  const repo = await createTempGitRepo();
  try {
    runAdl(repo, [
      'case-study',
      'init',
      'Contract Lab',
      '--decision',
      'Route',
      '--savepoint',
      'Before task',
    ]);

    const result = runAdl(repo, [
      'variant',
      'start',
      'alpha',
      '--from',
      'Before task',
      '--worktre',
    ], { allowFailure: true });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown option --worktre/);
    assert.match(result.stderr, /Did you mean --worktree/);
    const storeBranch = runAdl(repo, ['whereami', '--json']);
    assert.equal(JSON.parse(storeBranch.stdout).repository.branch, 'main');
  } finally {
    await cleanup(repo);
  }
});

test('keeps valid options and command arguments after the delimiter', async () => {
  const repo = await createTempGitRepo();
  try {
    runAdl(repo, ['init', 'Run Contract Lab']);
    const result = runAdl(repo, [
      'run',
      '--quiet',
      '--',
      process.execPath,
      '-e',
      'process.stdout.write("--not-an-adl-option")',
    ]);
    assert.equal(result.status, 0);
  } finally {
    await cleanup(repo);
  }
});

test('finds the closest supported option deterministically', () => {
  assert.equal(closestOption('worktre', ['branch', 'worktree', 'attach']), 'worktree');
});
