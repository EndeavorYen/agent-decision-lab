import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';

const repo = await createTempGitRepo();

try {
  runAdl(repo, ['init', 'Live Smoke Experiment']);
  runAdl(repo, [
    'decision',
    'create',
    'Context strategy',
    '--rationale',
    'Compare guidance-visible and prompt-only runs',
  ]);
  runAdl(repo, ['variant', 'start', 'guidance-first', '--decision', 'context-strategy']);
  runAdl(repo, ['log', 'prompt', '--stdin'], {
    input: 'Please design the change after reading project guidance.\n',
  });
  runAdl(repo, ['log', 'response', '--stdin'], {
    input: 'Synthetic response for smoke validation.\n',
  });
  runAdl(repo, ['checkpoint', 'Guidance-first design captured']);
  runAdl(repo, ['variant', 'start', 'prompt-only', '--decision', 'context-strategy']);
  runAdl(repo, ['log', 'note', 'Prompt-only branch started']);

  const tree = runAdl(repo, ['tree']).stdout;
  assert.match(tree, /Live Smoke Experiment/);
  assert.match(tree, /guidance-first/);
  assert.match(tree, /prompt-only/);

  const jsonOut = join(repo, '.agent-lab/exports/latest.json');
  const mdOut = join(repo, '.agent-lab/exports/latest.md');
  runAdl(repo, ['export', '--format', 'json', '--out', jsonOut]);
  runAdl(repo, ['export', '--format', 'markdown', '--out', mdOut]);

  const exported = JSON.parse(await readFile(jsonOut, 'utf8'));
  assert.equal(exported.experiment.title, 'Live Smoke Experiment');
  assert.equal(exported.variants.length, 2);
  assert.equal(exported.privacy.redactionApplied, true);
  assert.match(await readFile(mdOut, 'utf8'), /## Variant Comparison/);

  console.log(`Live smoke passed in ${repo}`);
} finally {
  await cleanup(repo);
}
