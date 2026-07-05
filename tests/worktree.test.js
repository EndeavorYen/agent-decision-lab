import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';

test('worktree lifecycle commands list status and dry-run cleanup ADL-owned worktrees', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(runAdl(repo, ['init', 'Worktree Lab']).status, 0);
    assert.equal(
      runAdl(repo, [
        'decision',
        'create',
        'Strategy',
        '--rationale',
        'Compare isolated worktrees',
      ]).status,
      0,
    );
    assert.equal(runAdl(repo, ['savepoint', 'create', 'Before fork', '--decision', 'strategy']).status, 0);
    assert.equal(
      runAdl(repo, [
        'variant',
        'start',
        'docs-visible',
        '--from',
        'before-fork',
        '--worktree',
      ]).status,
      0,
    );

    const list = runAdl(repo, ['worktree', 'list']);
    assert.equal(list.status, 0, list.stderr);
    assert.match(list.stdout, /docs-visible/);
    assert.match(list.stdout, /adl\/worktree_lab\/docs_visible/);
    assert.match(list.stdout, /registered/);

    const status = runAdl(repo, ['worktree', 'status']);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /Registered worktrees: 1/);
    assert.match(status.stdout, /Missing worktrees: 0/);

    const cleanupDryRun = runAdl(repo, ['worktree', 'cleanup', '--dry-run']);
    assert.equal(cleanupDryRun.status, 0, cleanupDryRun.stderr);
    assert.match(cleanupDryRun.stdout, /Would remove/);
    assert.match(cleanupDryRun.stdout, /docs-visible/);

    await access(join(repo, '..', `${basename(repo)}-agent-lab`, 'worktree_lab', 'docs_visible'));
  } finally {
    await cleanup(repo);
  }
});
