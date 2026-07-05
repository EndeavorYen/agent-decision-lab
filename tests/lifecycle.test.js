import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { cleanup, createTempGitRepo, readJson, run, runAdl } from './helpers.js';
import { appendEvent } from '../src/events.js';
import {
  createDecision,
  createExperimentStore,
  createSavepoint,
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

test('checks out a variant branch and marks it active', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Checkout Lab' });
    const decision = await createDecision(repo, {
      title: 'Context strategy',
      rationale: 'Compare context policies',
    });
    const variant = await startVariant(repo, {
      name: 'guidance-first',
      decision: decision.id,
      createBranch: true,
    });

    runAdl(repo, ['variant', 'checkout', 'guidance-first']);

    assert.equal(run('git', ['branch', '--show-current'], repo).stdout.trim(), variant.branch);
    const store = await loadCurrentStore(repo);
    assert.equal(store.config.activeVariantId, variant.id);
  } finally {
    await cleanup(repo);
  }
});

test('checks out a named branch from a savepoint and clears active variant', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Savepoint Lab' });
    const decision = await createDecision(repo, {
      title: 'Context strategy',
      rationale: 'Compare context policies',
    });
    const savepoint = await createSavepoint(repo, {
      title: 'Read project guidance?',
      decision: decision.id,
    });

    runAdl(repo, ['savepoint', 'checkout', 'Read project guidance?', '--branch', 'adl/replay/read-project-guidance']);

    assert.equal(run('git', ['branch', '--show-current'], repo).stdout.trim(), 'adl/replay/read-project-guidance');
    assert.equal(run('git', ['rev-parse', 'HEAD'], repo).stdout.trim(), savepoint.git.commit);
    const store = await loadCurrentStore(repo);
    assert.equal(store.config.activeVariantId, null);
  } finally {
    await cleanup(repo);
  }
});

test('records a command run under a variant', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Run Capture Lab' });
    const decision = await createDecision(repo, {
      title: 'Execution strategy',
      rationale: 'Compare live command runs',
    });
    await startVariant(repo, {
      name: 'prompt-only',
      decision: decision.id,
      createBranch: true,
    });

    runAdl(repo, [
      'run',
      '--variant',
      'prompt-only',
      '--',
      process.execPath,
      '-e',
      'console.log("agent output")',
    ]);

    const store = await loadCurrentStore(repo);
    assert.equal(store.events.length, 1);
    assert.equal(store.events[0].type, 'command');
    assert.equal(store.events[0].variantId, 'var_prompt_only');
    assert.equal(store.events[0].metadata.exitCode, 0);
    assert.match(store.events[0].body, /agent output/);
  } finally {
    await cleanup(repo);
  }
});

test('records command spawn errors for later diagnosis', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Run Failure Lab' });
    const decision = await createDecision(repo, {
      title: 'Execution strategy',
      rationale: 'Capture command failures',
    });
    await startVariant(repo, {
      name: 'prompt-only',
      decision: decision.id,
      createBranch: true,
    });

    const result = runAdl(repo, [
      'run',
      '--variant',
      'prompt-only',
      '--',
      'definitely-missing-adl-command',
    ], { allowFailure: true });

    assert.equal(result.status, 1);
    const store = await loadCurrentStore(repo);
    assert.equal(store.events.length, 1);
    assert.equal(store.events[0].metadata.error.code, 'ENOENT');
    assert.match(store.events[0].body, /spawn error:/);
  } finally {
    await cleanup(repo);
  }
});
