import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo, readJson, runAdl } from './helpers.js';

test('case-study workflow creates variants, records qualitative results, and exports a report pack', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(
      runAdl(repo, [
        'case-study',
        'init',
        'Review JSON Case Study',
        '--decision',
        'Agent strategy',
        '--savepoint',
        'Before review JSON task',
        '--rationale',
        'Compare agent collaboration strategies',
      ]).status,
      0,
    );

    assert.equal(
      runAdl(repo, [
        'case-study',
        'add-variant',
        'docs-visible',
        '--from',
        'before-review-json-task',
        '--context-policy',
        'docs-visible',
        '--prompt-summary',
        'Read docs first',
        '--worktree',
      ]).status,
      0,
    );
    assert.equal(
      runAdl(repo, [
        'case-study',
        'add-variant',
        'prompt-only',
        '--from',
        'before-review-json-task',
        '--context-policy',
        'prompt-only',
        '--prompt-summary',
        'Only inspect code and tests',
        '--worktree',
      ]).status,
      0,
    );

    assert.equal(
      runAdl(repo, [
        'case-study',
        'record-result',
        'docs-visible',
        '--artifact',
        'outputs/docs-visible.patch',
        '--strengths',
        'small patch',
        '--weaknesses',
        'loose assertions',
        '--evidence',
        'npm test passed',
        '--no-score',
      ]).status,
      0,
    );
    assert.equal(
      runAdl(repo, [
        'case-study',
        'record-result',
        'prompt-only',
        '--artifact',
        'outputs/prompt-only.patch',
        '--strengths',
        'focused output',
        '--weaknesses',
        'less project context',
        '--evidence',
        'npm test passed',
        '--no-score',
      ]).status,
      0,
    );

    const outDir = '.agent-lab/exports/review-json-case';
    const exported = runAdl(repo, [
      'case-study',
      'export',
      'docs-visible',
      'prompt-only',
      '--out-dir',
      outDir,
    ]);

    assert.equal(exported.status, 0, exported.stderr);
    assert.match(exported.stdout, /Wrote case-study exports/);

    for (const file of [
      'comparison.md',
      'guidance.md',
      'tree.svg',
      'report.html',
      'report.md',
      'export.json',
    ]) {
      await access(join(repo, outDir, file));
    }

    const comparison = await readFile(join(repo, outDir, 'comparison.md'), 'utf8');
    assert.match(comparison, /No winner selected/);
    assert.match(comparison, /Recommended next experiment/);
    assert.doesNotMatch(comparison, /\|\s*docs-visible\s*\|[^\n]*\|\s*0\s*\|/);

    const bundle = await readJson(join(repo, outDir, 'export.json'));
    assert.equal(bundle.variants.length, 2);
    assert.equal(bundle.evaluations.length, 2);
  } finally {
    await cleanup(repo);
  }
});
