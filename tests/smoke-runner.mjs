import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';

const repo = await createTempGitRepo();

try {
  runAdl(repo, ['init', 'Live Smoke Experiment']);
  runAdl(repo, [
    'template',
    'context-ab',
    '--question',
    'Should the agent read project guidance before writing code review rules?',
    '--decision',
    'Context visibility',
    '--a',
    'guidance-visible',
    '--b',
    'prompt-only',
    '--c',
    'draft-then-compare',
  ]);

  runAdl(repo, ['log', 'prompt', '--variant', 'guidance-visible', '--stdin'], {
    input: 'Write code review rules after reading the project guidance.\n',
  });
  runAdl(repo, ['log', 'response', '--variant', 'guidance-visible', '--stdin'], {
    input: 'Synthetic guidance-visible review rules.\n',
  });
  runAdl(repo, [
    'artifact',
    'add',
    'guidance-visible-rules',
    '--variant',
    'guidance-visible',
    '--path',
    'outputs/guidance-visible-rules.md',
    '--summary',
    'Synthetic guidance-visible rules',
  ]);
  runAdl(repo, [
    'artifact',
    'add',
    'prompt-only-rules',
    '--variant',
    'prompt-only',
    '--path',
    'outputs/prompt-only-rules.md',
    '--summary',
    'Synthetic prompt-only rules',
  ]);
  runAdl(repo, [
    'artifact',
    'add',
    'draft-then-compare-rules',
    '--variant',
    'draft-then-compare',
    '--path',
    'outputs/draft-then-compare-rules.md',
    '--summary',
    'Synthetic delayed-guidance rules',
  ]);
  runAdl(repo, [
    'evaluate',
    'guidance-visible',
    '--scores',
    '{"alignment":5,"specificity":4,"signalToNoise":3,"riskCoverage":5}',
    '--strengths',
    'Aligned with project guidance',
    '--weaknesses',
    'Some broad language',
    '--evidence',
    'guidance-visible-rules',
  ]);
  runAdl(repo, [
    'evaluate',
    'prompt-only',
    '--scores',
    '{"alignment":3,"specificity":5,"signalToNoise":5,"riskCoverage":3}',
    '--strengths',
    'Focused output',
    '--weaknesses',
    'Less project-specific',
    '--evidence',
    'prompt-only-rules',
  ]);
  runAdl(repo, [
    'evaluate',
    'draft-then-compare',
    '--scores',
    '{"alignment":4,"specificity":4,"signalToNoise":4,"riskCoverage":4}',
    '--strengths',
    'Balances focus and alignment',
    '--weaknesses',
    'Requires extra review pass',
    '--evidence',
    'draft-then-compare-rules',
  ]);

  const tree = runAdl(repo, ['tree']).stdout;
  assert.match(tree, /Live Smoke Experiment/);
  assert.match(tree, /Read project guidance\?/);
  assert.match(tree, /guidance-visible/);
  assert.match(tree, /prompt-only/);
  assert.match(tree, /draft-then-compare/);

  const jsonOut = join(repo, '.agent-lab/exports/latest.json');
  const mdOut = join(repo, '.agent-lab/exports/latest.md');
  const mermaidOut = join(repo, '.agent-lab/exports/tree.mmd');
  const comparisonOut = join(repo, '.agent-lab/exports/comparison.md');
  const guidanceOut = join(repo, '.agent-lab/exports/guidance.md');
  runAdl(repo, [
    'compare',
    'guidance-visible',
    'prompt-only',
    'draft-then-compare',
    '--out',
    comparisonOut,
  ]);
  runAdl(repo, [
    'guidance',
    'draft',
    '--comparison',
    'cmp_guidance_visible_vs_prompt_only_vs_draft_then_compare',
    '--out',
    guidanceOut,
  ]);
  runAdl(repo, ['export', '--format', 'json', '--out', jsonOut]);
  runAdl(repo, ['export', '--format', 'markdown', '--out', mdOut]);
  runAdl(repo, ['export', '--format', 'mermaid', '--out', mermaidOut]);

  const exported = JSON.parse(await readFile(jsonOut, 'utf8'));
  assert.equal(exported.experiment.title, 'Live Smoke Experiment');
  assert.equal(exported.savepoints.length, 1);
  assert.equal(exported.variants.length, 3);
  assert.equal(new Set(exported.variants.map((variant) => variant.baseCommit)).size, 1);
  assert.equal(exported.strategies.length, 3);
  assert.equal(exported.evaluations.length, 3);
  assert.equal(exported.comparisons.length, 1);
  assert.equal(exported.privacy.redactionApplied, true);
  assert.match(await readFile(mdOut, 'utf8'), /## Variant Comparison/);
  assert.match(await readFile(mermaidOut, 'utf8'), /Savepoint: Read project guidance\?/);
  assert.match(await readFile(comparisonOut, 'utf8'), /## Savepoint and Fork Summary/);
  assert.match(await readFile(guidanceOut, 'utf8'), /# Agent Collaboration Guidance/);

  console.log(`Live smoke passed in ${repo}`);
} finally {
  await cleanup(repo);
}
