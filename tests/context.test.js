import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { cleanup, createTempGitRepo, run, runAdl } from './helpers.js';

test('whereami identifies base checkout and registered variant worktree', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(runAdl(repo, ['lab', 'start', 'Context Lab', '--variants', 'docs-visible,prompt-only', '--worktree']).status, 0);

    const base = runAdl(repo, ['whereami', '--json']);
    assert.equal(base.status, 0, base.stderr);
    const baseState = JSON.parse(base.stdout);
    assert.equal(baseState.role, 'base-checkout');
    assert.equal(baseState.experiment.title, 'Context Lab');
    assert.equal(baseState.activeVariant, null);
    assert.equal(baseState.privateLabIgnore.status, 'warn');
    assert.deepEqual(baseState.dirtyNonLabFiles, []);

    const variantWorktree = join(repo, '..', `${basename(repo)}-agent-lab`, 'context_lab', 'docs_visible');
    const variant = runAdl(variantWorktree, ['whereami', '--json']);
    assert.equal(variant.status, 0, variant.stderr);
    const variantState = JSON.parse(variant.stdout);
    assert.equal(variantState.role, 'registered-variant-worktree');
    assert.equal(variantState.experiment.title, 'Context Lab');
    assert.equal(variantState.activeVariant.name, 'docs-visible');
    assert.match(variantState.next.join('\n'), /adl orchestrate docs-visible/);
  } finally {
    await cleanup(repo);
  }
});

test('whereami reports unknown worktrees without reading private bodies', async () => {
  const repo = await createTempGitRepo();
  const unknownWorktree = join(repo, '..', `${basename(repo)}-unknown`);
  try {
    assert.equal(runAdl(repo, ['init', 'Base Lab']).status, 0);
    run('git', ['worktree', 'add', '-b', 'unknown-context', unknownWorktree, 'HEAD'], repo);

    const result = runAdl(unknownWorktree, ['whereami', '--json']);
    assert.equal(result.status, 0, result.stderr);
    const state = JSON.parse(result.stdout);
    assert.equal(state.role, 'unknown-checkout');
    assert.equal(state.experiment, null);
    assert.equal(state.activeVariant, null);
    assert.match(state.next.join('\n'), /Run adl doctor/);
  } finally {
    await rm(unknownWorktree, { recursive: true, force: true });
    await cleanup(repo);
  }
});
