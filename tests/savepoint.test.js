import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo, run } from './helpers.js';
import {
  createDecision,
  createExperimentStore,
  createSavepoint,
  loadCurrentStore,
  startVariant,
} from '../src/store.js';

test('creates a forkable savepoint and forks three variants from the same commit', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Project Guidance Strategy Lab' });
    const decision = await createDecision(repo, {
      title: 'Context visibility',
      rationale: 'Compare whether the agent should read project guidance before writing rules',
    });
    const savepoint = await createSavepoint(repo, {
      title: 'Read project guidance?',
      decision: decision.id,
      rationale: 'Fork all context strategies from the same clean state',
    });

    const head = run('git', ['rev-parse', 'HEAD'], repo).stdout.trim();
    assert.equal(savepoint.git.commit, head);
    assert.equal(savepoint.git.isDirty, false);

    const visible = await startVariant(repo, {
      name: 'guidance-visible',
      from: savepoint.id,
      createBranch: true,
    });
    const promptOnly = await startVariant(repo, {
      name: 'prompt-only',
      from: 'read-project-guidance',
      createBranch: true,
    });
    const delayed = await startVariant(repo, {
      name: 'draft-then-compare',
      from: savepoint.id,
      createBranch: true,
    });

    assert.equal(visible.savepointId, savepoint.id);
    assert.equal(promptOnly.savepointId, savepoint.id);
    assert.equal(delayed.savepointId, savepoint.id);
    assert.equal(visible.parentVariantId, null);
    assert.equal(promptOnly.parentVariantId, null);
    assert.equal(delayed.parentVariantId, null);
    assert.equal(visible.baseCommit, savepoint.git.commit);
    assert.equal(promptOnly.baseCommit, savepoint.git.commit);
    assert.equal(delayed.baseCommit, savepoint.git.commit);
    assert.equal(run('git', ['rev-parse', visible.branch], repo).stdout.trim(), savepoint.git.commit);
    assert.equal(run('git', ['rev-parse', promptOnly.branch], repo).stdout.trim(), savepoint.git.commit);
    assert.equal(run('git', ['rev-parse', delayed.branch], repo).stdout.trim(), savepoint.git.commit);

    const store = await loadCurrentStore(repo);
    assert.equal(store.savepoints.length, 1);
    assert.equal(store.tree.nodes.filter((node) => node.type === 'savepoint').length, 1);
  } finally {
    await cleanup(repo);
  }
});

test('rejects forkable savepoints when non-lab files are dirty', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Dirty Savepoint Lab' });
    const decision = await createDecision(repo, {
      title: 'Context visibility',
      rationale: 'Compare context strategies',
    });
    await writeFile(join(repo, 'dirty.txt'), 'uncommitted work\n');

    await assert.rejects(
      () => createSavepoint(repo, {
        title: 'Read project guidance?',
        decision: decision.id,
      }),
      /Cannot create forkable savepoint with uncommitted changes outside .agent-lab/,
    );
  } finally {
    await cleanup(repo);
  }
});

test('forks a new branch from a savepoint even when current work is dirty', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Dirty Current Path Lab' });
    const decision = await createDecision(repo, {
      title: 'Context visibility',
      rationale: 'Compare context strategies',
    });
    const savepoint = await createSavepoint(repo, {
      title: 'Read project guidance?',
      decision: decision.id,
    });
    await writeFile(join(repo, 'dirty.txt'), 'work in progress on current path\n');

    const variant = await startVariant(repo, {
      name: 'prompt-only',
      from: savepoint.id,
      createBranch: true,
    });

    assert.equal(variant.baseCommit, savepoint.git.commit);
    assert.equal(run('git', ['rev-parse', variant.branch], repo).stdout.trim(), savepoint.git.commit);
  } finally {
    await cleanup(repo);
  }
});
