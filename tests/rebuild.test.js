import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo, readJson, run, runAdl } from './helpers.js';
import { loadCurrentStore } from '../src/store.js';

test('rebuild init creates a blank strategy lab with kept files and variant worktrees', async () => {
  const repo = await createTempGitRepo();
  const baseWorktree = `${repo}-rebuild-base`;
  try {
    await writeFile(join(repo, 'AGENTS.md'), '# Agent rules\n');
    await writeFile(join(repo, 'app.js'), 'console.log("remove me");\n');
    run('git', ['add', 'AGENTS.md', 'app.js'], repo);
    run('git', ['commit', '-m', 'add target files'], repo);

    const result = runAdl(repo, [
      'rebuild',
      'init',
      'AI Reviewer Rebuild From Blank',
      '--base',
      'HEAD',
      '--base-worktree',
      baseWorktree,
      '--keep',
      'AGENTS.md',
      '--decision',
      'Context strategy',
      '--savepoint',
      'Blank baseline',
      '--variants',
      'guidance-visible,prompt-only,draft-then-guidance',
      '--worktree',
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Base lab:/);
    assert.match(result.stdout, /Variant worktrees:/);
    assert.equal(await readFile(join(baseWorktree, 'AGENTS.md'), 'utf8'), '# Agent rules\n');
    await assert.rejects(() => access(join(baseWorktree, 'app.js')));

    const store = await loadCurrentStore(baseWorktree);
    assert.equal(store.experiment.title, 'AI Reviewer Rebuild From Blank');
    assert.equal(store.savepoints[0].title, 'Blank baseline');
    assert.deepEqual(store.variants.map((variant) => variant.name).sort(), [
      'draft-then-guidance',
      'guidance-visible',
      'prompt-only',
    ]);
    for (const variant of store.variants) {
      assert.ok(variant.worktreePath);
      const head = run('git', ['rev-parse', 'HEAD'], variant.worktreePath).stdout.trim();
      assert.equal(head, store.savepoints[0].git.commit);
    }

    const config = await readJson(join(baseWorktree, '.agent-lab/config.json'));
    assert.equal(config.currentExperimentId, store.experiment.id);
  } finally {
    await rm(baseWorktree, { recursive: true, force: true });
    await cleanup(repo);
  }
});
