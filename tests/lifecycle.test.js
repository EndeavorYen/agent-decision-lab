import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { cleanup, createTempGitRepo, readJson, run } from './helpers.js';
import { appendEvent } from '../src/events.js';
import {
  createDecision,
  createExperimentStore,
  loadCurrentStore,
  startVariant,
} from '../src/store.js';

test('creates a decision, starts a branch variant, and logs a note event', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Checkout Lab' });

    const decision = await createDecision(repo, {
      title: 'Context strategy',
      rationale: 'Compare guidance-visible and prompt-only runs',
    });
    const variant = await startVariant(repo, {
      name: 'guidance-first',
      decision: decision.id,
      createBranch: true,
    });
    const event = await appendEvent(repo, {
      type: 'note',
      body: 'Design approved',
      actor: 'human',
    });

    assert.equal(decision.id, 'dec_context_strategy');
    assert.equal(variant.id, 'var_guidance_first');
    assert.equal(variant.decisionId, decision.id);
    assert.equal(variant.branch, 'adl/checkout_lab/guidance_first');
    assert.equal(event.variantId, variant.id);

    const branch = run('git', ['rev-parse', '--verify', variant.branch], repo);
    assert.equal(branch.status, 0);

    const store = await loadCurrentStore(repo);
    assert.equal(store.config.activeVariantId, variant.id);
    assert.equal(store.events.length, 1);
  } finally {
    await cleanup(repo);
  }
});

test('creates a worktree variant without switching the main checkout', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Checkout Lab' });
    const decision = await createDecision(repo, {
      title: 'Implementation style',
      rationale: 'Compare spec-first and implementation-first work',
    });

    const variant = await startVariant(repo, {
      name: 'spec-first',
      decision: decision.id,
      createBranch: true,
      createWorktree: true,
    });

    assert.match(variant.worktreePath, /spec_first$/);
    assert.equal(basename(variant.worktreePath), 'spec_first');
    assert.equal(
      run('git', ['branch', '--show-current'], repo).stdout.trim(),
      'main',
    );
    assert.equal(
      run('git', ['branch', '--show-current'], variant.worktreePath).stdout.trim(),
      variant.branch,
    );
  } finally {
    await cleanup(repo);
  }
});

test('refuses to start a new variant when non-lab files are dirty', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Dirty Lab' });
    const decision = await createDecision(repo, {
      title: 'Context strategy',
      rationale: 'Compare context policies',
    });
    await writeFile(join(repo, 'dirty.txt'), 'uncommitted target change\n');

    await assert.rejects(
      () => startVariant(repo, {
        name: 'prompt-only',
        decision: decision.id,
        createBranch: true,
      }),
      /uncommitted changes outside .agent-lab/,
    );

    const config = await readJson(join(repo, '.agent-lab/config.json'));
    assert.equal(config.activeVariantId, null);
  } finally {
    await cleanup(repo);
  }
});
