import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod } from 'node:fs/promises';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';
import { createBranch } from '../src/git.js';
import { beginOperation } from '../src/operations.js';
import { inspectRecovery } from '../src/recovery.js';
import {
  createDecision,
  createExperimentStore,
  createSavepoint,
  checkoutSavepoint,
  checkoutVariant,
  loadCurrentStore,
  startVariant,
} from '../src/store.js';

test('does not journal precondition failures before Git side effects start', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Failed Operation Lab' });
    const decision = await createDecision(repo, { title: 'Route' });
    const savepoint = await createSavepoint(repo, {
      title: 'Before task',
      decision: decision.id,
    });
    createBranch(repo, 'adl/failed_operation_lab/alpha', savepoint.git.commit);

    await assert.rejects(
      () => startVariant(repo, { name: 'alpha', from: savepoint.id }),
      /Branch already exists/,
    );

    const recovery = await inspectRecovery(repo);
    assert.equal(recovery.pending.length, 0);
  } finally {
    await cleanup(repo);
  }
});

test('journals variant and savepoint checkout operations', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Checkout Journal Lab' });
    const decision = await createDecision(repo, { title: 'Route' });
    const savepoint = await createSavepoint(repo, {
      title: 'Before task',
      decision: decision.id,
    });
    const variant = await startVariant(repo, { name: 'alpha', from: savepoint.id });

    await checkoutVariant(repo, { variant: variant.id });
    await checkoutSavepoint(repo, {
      savepoint: savepoint.id,
      branch: 'adl/checkout-journal/replay',
    });

    const store = await loadCurrentStore(repo);
    assert.equal(store.operations.some((operation) => (
      operation.type === 'checkout-variant' && operation.status === 'complete'
    )), true);
    assert.equal(store.operations.some((operation) => (
      operation.type === 'checkout-savepoint' && operation.status === 'complete'
    )), true);
  } finally {
    await cleanup(repo);
  }
});

test('records failure after Git succeeds but variant metadata cannot be written', async () => {
  const repo = await createTempGitRepo();
  let variantsDir;
  try {
    await createExperimentStore(repo, { title: 'Partial Variant Lab' });
    const decision = await createDecision(repo, { title: 'Route' });
    const savepoint = await createSavepoint(repo, {
      title: 'Before task',
      decision: decision.id,
    });
    variantsDir = (await loadCurrentStore(repo)).paths.variantsDir;
    await chmod(variantsDir, 0o500);

    await assert.rejects(
      () => startVariant(repo, { name: 'alpha', from: savepoint.id }),
      /EACCES|permission denied/i,
    );
    await chmod(variantsDir, 0o700);

    const recovery = await inspectRecovery(repo);
    assert.equal(recovery.pending.length, 1);
    assert.equal(recovery.pending[0].status, 'failed');
    assert.equal(recovery.pending[0].branchExists, true);
    assert.equal(recovery.pending[0].metadataExists, false);
  } finally {
    if (variantsDir) await chmod(variantsDir, 0o700).catch(() => {});
    await cleanup(repo);
  }
});

test('reports a prepared orphan Git branch without changing it', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Prepared Operation Lab' });
    const decision = await createDecision(repo, { title: 'Route' });
    const savepoint = await createSavepoint(repo, {
      title: 'Before task',
      decision: decision.id,
    });
    const store = await loadCurrentStore(repo);
    const operation = await beginOperation(store, {
      type: 'start-variant',
      variantId: 'var_alpha',
      variantName: 'alpha',
      branch: 'adl/prepared_operation_lab/alpha',
      worktreePath: null,
      baseCommit: savepoint.git.commit,
    });
    createBranch(repo, operation.branch, operation.baseCommit);

    const recovery = await inspectRecovery(repo);
    assert.equal(recovery.pending.length, 1);
    assert.equal(recovery.pending[0].status, 'prepared');
    assert.equal(recovery.pending[0].branchExists, true);
    assert.equal(recovery.pending[0].metadataExists, false);
    assert.match(recovery.pending[0].action, /attach/i);

    const dryRun = runAdl(repo, ['repair', '--dry-run']);
    assert.equal(dryRun.status, 0);
    assert.match(dryRun.stdout, /dry-run/i);
    assert.match(dryRun.stdout, /var_alpha/);
    assert.equal(runAdl(repo, ['repair'], { allowFailure: true }).status, 1);
  } finally {
    await cleanup(repo);
  }
});
