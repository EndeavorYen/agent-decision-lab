import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, createTempGitRepo } from './helpers.js';
import { createExperimentStore, loadCurrentStore } from '../src/store.js';
import { createContextAbTemplate } from '../src/templates.js';

test('context-ab template creates decision, savepoint, variants, and strategies', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Project Guidance Strategy Lab' });

    const result = await createContextAbTemplate(repo, {
      question: 'Should the agent read project guidance before writing code review rules?',
      decision: 'Context visibility',
      a: 'guidance-visible',
      b: 'prompt-only',
      c: 'draft-then-compare',
    });

    assert.equal(result.decision.title, 'Context visibility');
    assert.equal(result.savepoint.title, 'Read project guidance?');
    assert.deepEqual(result.variants.map((variant) => variant.name), [
      'guidance-visible',
      'prompt-only',
      'draft-then-compare',
    ]);

    const store = await loadCurrentStore(repo);
    assert.equal(store.savepoints.length, 1);
    assert.equal(store.strategies.length, 3);
    assert.equal(store.variants.length, 3);
    assert.equal(new Set(store.variants.map((variant) => variant.baseCommit)).size, 1);
  } finally {
    await cleanup(repo);
  }
});
