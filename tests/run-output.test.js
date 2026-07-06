import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';
import { loadCurrentStore } from '../src/store.js';

test('adl run --quiet records full output without flooding the terminal', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(runAdl(repo, ['init', 'Run Output Lab']).status, 0);

    const result = runAdl(repo, [
      'run',
      '--quiet',
      '--',
      process.execPath,
      '-e',
      'console.log("very noisy line")',
    ]);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /very noisy line/);
    assert.match(result.stdout, /Recorded command/);
    assert.match(result.stdout, /exit 0/);

    const store = await loadCurrentStore(repo);
    assert.match(store.events.at(-1).body, /very noisy line/);
    assert.equal(store.events.at(-1).metadata.exitCode, 0);
    assert.equal(typeof store.events.at(-1).metadata.durationMs, 'number');
    assert.equal(store.events.at(-1).metadata.stdoutBytes > 0, true);
  } finally {
    await cleanup(repo);
  }
});

test('adl run --tail prints only the requested tail lines', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(runAdl(repo, ['init', 'Run Tail Lab']).status, 0);

    const result = runAdl(repo, [
      'run',
      '--tail',
      '2',
      '--',
      process.execPath,
      '-e',
      'for (let i = 1; i <= 5; i += 1) console.log(`line-${i}`)',
    ]);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /line-1/);
    assert.match(result.stdout, /line-4/);
    assert.match(result.stdout, /line-5/);
  } finally {
    await cleanup(repo);
  }
});

test('adl run --quiet still makes failing commands obvious', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(runAdl(repo, ['init', 'Run Failure Lab']).status, 0);

    const result = runAdl(repo, [
      'run',
      '--quiet',
      '--',
      process.execPath,
      '-e',
      'console.error("hidden failure detail"); process.exit(7)',
    ], { allowFailure: true });
    assert.equal(result.status, 7);
    assert.doesNotMatch(result.stderr, /hidden failure detail/);
    assert.match(result.stdout, /Command failed exit 7/);
    assert.match(result.stdout, /Recorded command/);
  } finally {
    await cleanup(repo);
  }
});
