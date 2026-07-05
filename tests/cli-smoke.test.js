import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';

test('runs the MVP workflow through the adl CLI', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(runAdl(repo, ['--help']).status, 0);
    assert.equal(runAdl(repo, ['init', 'Smoke Experiment']).status, 0);
    assert.equal(
      runAdl(repo, [
        'decision',
        'create',
        'Context strategy',
        '--rationale',
        'Compare context policies',
      ]).status,
      0,
    );
    assert.equal(
      runAdl(repo, ['variant', 'start', 'guidance-first', '--decision', 'context-strategy']).status,
      0,
    );
    assert.equal(runAdl(repo, ['log', 'note', 'Design approved']).status, 0);
    assert.equal(runAdl(repo, ['checkpoint', 'Ready for implementation']).status, 0);

    const tree = runAdl(repo, ['tree']);
    assert.equal(tree.status, 0);
    assert.match(tree.stdout, /Smoke Experiment/);
    assert.match(tree.stdout, /guidance-first/);

    const jsonOut = join(repo, '.agent-lab/exports/smoke.json');
    const mdOut = join(repo, '.agent-lab/exports/smoke.md');
    assert.equal(runAdl(repo, ['export', '--format', 'json', '--out', jsonOut]).status, 0);
    assert.equal(runAdl(repo, ['export', '--format', 'markdown', '--out', mdOut]).status, 0);

    const exported = JSON.parse(await readFile(jsonOut, 'utf8'));
    assert.equal(exported.experiment.title, 'Smoke Experiment');
    assert.equal(exported.privacy.includeEventBodies, false);
    assert.match(await readFile(mdOut, 'utf8'), /# Smoke Experiment/);
  } finally {
    await cleanup(repo);
  }
});
