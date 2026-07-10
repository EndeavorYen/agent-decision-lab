import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';
import { loadCurrentStore } from '../src/store.js';

test('ADL commands invoked inside a registered variant worktree use the owning lab store', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(
      runAdl(repo, [
        'case-study',
        'init',
        'Strategy Lab',
        '--decision',
        'Context strategy',
        '--savepoint',
        'Before task',
      ]).status,
      0,
    );

    const added = runAdl(repo, [
      'case-study',
      'add-variant',
      'guidance-visible',
      '--from',
      'Before task',
      '--context-policy',
      'guidance-visible',
      '--worktree',
    ]);
    const worktree = added.stdout.match(/Worktree: (.+)/)?.[1];
    assert.ok(worktree);

    assert.equal(
      runAdl(worktree, [
        'log',
        'note',
        '--variant',
        'guidance-visible',
        'Started from variant worktree',
      ]).status,
      0,
    );
    assert.match(runAdl(worktree, ['status']).stdout, /Strategy Lab/);
    assert.match(runAdl(worktree, ['tree']).stdout, /guidance-visible/);
    assert.equal(runAdl(worktree, ['checkpoint', 'Worktree checkpoint']).status, 0);

    const store = await loadCurrentStore(repo);
    assert.equal(store.events.some((event) => event.body === 'Started from variant worktree'), true);
    assert.equal(store.events.some((event) => event.body === 'Worktree checkpoint'), true);
  } finally {
    await cleanup(repo);
  }
});

test('events without an explicit variant use the invoking registered worktree', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(
      runAdl(repo, [
        'case-study',
        'init',
        'Attribution Lab',
        '--decision',
        'Route',
        '--savepoint',
        'Before task',
      ]).status,
      0,
    );

    const alphaResult = runAdl(repo, [
      'case-study',
      'add-variant',
      'alpha',
      '--from',
      'Before task',
      '--worktree',
    ]);
    const alphaWorktree = alphaResult.stdout.match(/Worktree: (.+)/)?.[1];
    assert.ok(alphaWorktree);

    assert.equal(
      runAdl(repo, [
        'case-study',
        'add-variant',
        'beta',
        '--from',
        'Before task',
        '--worktree',
      ]).status,
      0,
    );

    assert.equal(
      runAdl(alphaWorktree, ['checkpoint', 'alpha worktree checkpoint']).status,
      0,
    );

    const store = await loadCurrentStore(repo);
    const event = store.events.find((record) => record.body === 'alpha worktree checkpoint');
    const alpha = store.variants.find((record) => record.name === 'alpha');
    assert.equal(event.variantId, alpha.id);
  } finally {
    await cleanup(repo);
  }
});
