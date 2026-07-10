import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { adlBin, cleanup, createTempGitRepo, runAdl } from './helpers.js';
import { loadCurrentStore } from '../src/store.js';

const execFileAsync = promisify(execFile);

test('v0.2 preserves parallel writers and worktree attribution through export and reload', async () => {
  const repo = await createTempGitRepo();
  try {
    runAdl(repo, [
      'lab',
      'start',
      'v0.2 Acceptance Lab',
      '--decision',
      'Parallel route',
      '--savepoint',
      'Before acceptance',
      '--variants',
      'alpha,beta,gamma',
      '--worktree',
    ]);

    const initialized = await loadCurrentStore(repo);
    assert.equal(initialized.variants.length, 3);
    assert.equal(initialized.variants.every((variant) => variant.worktreePath), true);

    await Promise.all(initialized.variants.map((variant) => (
      runProcess(variant.worktreePath, [
        'checkpoint',
        `${variant.name} parallel checkpoint`,
      ])
    )));

    await Promise.all(Array.from({ length: 20 }, (_, index) => (
      runProcess(repo, ['decision', 'create', `parallel-decision-${index}`])
    )));

    const exportPath = '.agent-lab/exports/v0.2-acceptance.json';
    runAdl(repo, [
      'insight',
      'export',
      '--variants',
      'alpha,beta,gamma',
      '--out',
      exportPath,
    ]);
    assert.equal(runAdl(repo, ['doctor']).status, 0);
    assert.match(runAdl(repo, ['migrate', '--dry-run']).stdout, /Changed files: 0/);
    assert.match(runAdl(repo, ['repair', '--dry-run']).stdout, /No incomplete operations/);
    assert.equal(
      runAdl(repo, ['privacy', 'audit', '--path', exportPath, '--json']).status,
      0,
    );

    const reloaded = await loadCurrentStore(repo);
    const decisions = reloaded.tree.nodes.filter((node) => node.type === 'decision');
    assert.equal(decisions.length, 21);
    for (const variant of reloaded.variants) {
      const event = reloaded.events.find((record) => (
        record.body === `${variant.name} parallel checkpoint`
      ));
      assert.equal(event.variantId, variant.id);
    }
    assert.equal(reloaded.config.schemaVersion, 'agent-decision-lab/v2');
    assert.equal(reloaded.operations.every((operation) => operation.status === 'complete'), true);
  } finally {
    await cleanup(repo);
  }
});

async function runProcess(cwd, args) {
  return execFileAsync(process.execPath, [adlBin, ...args], {
    cwd,
    timeout: 45_000,
    maxBuffer: 1024 * 1024,
  });
}
