import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';
import { loadCurrentStore } from '../src/store.js';

test('orchestrate prints the next route and records responses and checkpoints', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(
      runAdl(repo, [
        'case-study',
        'init',
        'Guided Lab',
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
      '--visible-context',
      'README.md,AGENTS.md',
      '--withheld-context',
      'private-transcript',
      '--hypothesis',
      'Project docs improve alignment',
      '--worktree',
    ]);
    const worktree = added.stdout.match(/Worktree: (.+)/)?.[1];
    assert.ok(worktree);

    const guide = runAdl(repo, ['orchestrate', 'guidance-visible']);
    assert.equal(guide.status, 0);
    assert.match(guide.stdout, /Current lab: Guided Lab/);
    assert.match(guide.stdout, /Metadata operations:/);
    assert.match(guide.stdout, /Code worktree:/);
    assert.match(guide.stdout, /README.md/);
    assert.match(guide.stdout, /private-transcript/);

    const recorded = runAdl(repo, [
      'orchestrate',
      '--variant',
      'guidance-visible',
      '--response',
      'Synthetic agent response',
      '--checkpoint',
      'Response reviewed',
    ]);
    assert.equal(recorded.status, 0);
    assert.match(recorded.stdout, /Recorded response/);
    assert.match(recorded.stdout, /Recorded checkpoint/);

    const store = await loadCurrentStore(repo);
    assert.equal(store.events.some((event) => event.type === 'response' && event.body === 'Synthetic agent response'), true);
    assert.equal(store.events.some((event) => event.type === 'checkpoint' && event.body === 'Response reviewed'), true);
  } finally {
    await cleanup(repo);
  }
});
