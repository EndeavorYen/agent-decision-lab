import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';

test('lab start creates a two-variant strategy lab with next steps', async () => {
  const repo = await createTempGitRepo();
  try {
    const result = runAdl(repo, [
      'lab',
      'start',
      'Wizard Lab',
      '--decision',
      'Context visibility',
      '--savepoint',
      'Before strategy fork',
      '--variants',
      'docs-visible,prompt-only',
      '--context-policies',
      'docs-visible,prompt-only',
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Created strategy lab/);
    assert.match(result.stdout, /adl status/);
    assert.match(result.stdout, /adl orchestrate docs-visible/);

    const status = runAdl(repo, ['status']);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /Experiment: Wizard Lab/);
    assert.match(status.stdout, /Variants: 2/);

    const tree = runAdl(repo, ['tree']);
    assert.match(tree.stdout, /Context visibility/);
    assert.match(tree.stdout, /docs-visible/);
    assert.match(tree.stdout, /prompt-only/);
  } finally {
    await cleanup(repo);
  }
});

test('lab start refuses dirty non-lab files before writing metadata', async () => {
  const repo = await createTempGitRepo();
  try {
    await writeFile(join(repo, 'src.js'), 'console.log("dirty");\n');

    const result = runAdl(repo, ['lab', 'start', 'Dirty Lab'], { allowFailure: true });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing to start lab with dirty non-lab files/);

    const labConfig = await readFile(join(repo, '.agent-lab', 'config.json'), 'utf8').catch(() => null);
    assert.equal(labConfig, null);
  } finally {
    await cleanup(repo);
  }
});
