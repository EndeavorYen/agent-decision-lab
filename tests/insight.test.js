import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo, readJson, runAdl } from './helpers.js';

test('insight export writes a bounded redacted analysis pack', async () => {
  const repo = await createTempGitRepo();
  try {
    assert.equal(runAdl(repo, ['lab', 'start', 'Insight Lab', '--variants', 'docs-visible,prompt-only']).status, 0);
    assert.equal(runAdl(repo, ['log', 'prompt', '--variant', 'docs-visible', '--stdin'], {
      input: 'Read private plan at /Users/example/Code/target/PLAN.md before coding.',
    }).status, 0);
    assert.equal(runAdl(repo, ['log', 'command', '--variant', 'docs-visible', '--metadata', '{"status":0,"command":"npm test"}', '--stdin'], {
      input: 'npm test passed from /Users/example/Code/target',
    }).status, 0);
    assert.equal(runAdl(repo, ['evaluate', 'docs-visible', '--no-score', '--evidence', 'npm test passed']).status, 0);
    assert.equal(runAdl(repo, ['compare', 'docs-visible', 'prompt-only', '--out', '.agent-lab/exports/comparison.md']).status, 0);

    const out = '.agent-lab/exports/insight-pack.json';
    const exported = runAdl(repo, ['insight', 'export', '--variants', 'docs-visible,prompt-only', '--out', out]);
    assert.equal(exported.status, 0, exported.stderr);
    assert.match(exported.stdout, /Wrote insight pack/);

    const pack = await readJson(join(repo, out));
    assert.equal(pack.schemaVersion, 'agent-decision-lab/insight-pack/v1');
    assert.equal(pack.privacy.mode, 'redacted');
    assert.equal(pack.privacy.includePrivateBodies, false);
    assert.deepEqual(pack.variants.map((variant) => variant.name), ['docs-visible', 'prompt-only']);
    assert.equal(pack.timeline.some((event) => event.type === 'prompt' && event.body === undefined), true);
    assert.equal(pack.commandOutcomes.some((item) => item.variant === 'docs-visible' && item.status === 0), true);
    assert.equal(pack.comparisons.length, 1);
    assert.equal(pack.missingEvidenceWarnings.some((warning) => /prompt-only/.test(warning.message)), true);

    const raw = await readFile(join(repo, out), 'utf8');
    assert.doesNotMatch(raw, /private plan/);
    assert.doesNotMatch(raw, /\/Users\/example/);
    assert.match(raw, /\[REDACTED_LOCAL_PATH\]/);
  } finally {
    await cleanup(repo);
  }
});
