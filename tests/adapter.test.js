import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';

test('adapter commands list show and scaffold provider-neutral recipes', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(runAdl(repo, ['init', 'Adapter Lab']).status, 0);

    const listed = runAdl(repo, ['adapter', 'list']);
    assert.equal(listed.status, 0);
    assert.match(listed.stdout, /manual/);
    assert.match(listed.stdout, /command-wrapper/);

    const shown = runAdl(repo, ['adapter', 'show', 'manual']);
    assert.equal(shown.status, 0);
    assert.match(shown.stdout, /Provider-neutral/);
    assert.match(shown.stdout, /adl log prompt/);

    const scaffold = runAdl(repo, [
      'plugin',
      'scaffold',
      'manual',
      '--variant',
      'readme-visible',
      '--out',
      '.agent-lab/adapters/manual.md',
    ]);
    assert.equal(scaffold.status, 0);
    assert.match(scaffold.stdout, /Scaffolded manual adapter/);

    const guide = await readFile(join(repo, '.agent-lab/adapters/manual.md'), 'utf8');
    assert.match(guide, /Provider-neutral/);
    assert.match(guide, /readme-visible/);
    assert.doesNotMatch(guide, /api key/i);
  } finally {
    await cleanup(repo);
  }
});

test('adapter show fails closed for unknown recipes', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(runAdl(repo, ['init', 'Adapter Lab']).status, 0);

    const result = runAdl(repo, ['adapter', 'show', 'missing-provider'], { allowFailure: true });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown adapter/);
  } finally {
    await cleanup(repo);
  }
});
