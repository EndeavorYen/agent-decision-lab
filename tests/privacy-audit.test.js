import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';

test('privacy audit catches secrets local paths and blocklist terms', async () => {
  const repo = await createTempGitRepo();
  try {
    await mkdir(join(repo, '.agent-lab', 'exports'), { recursive: true });
    await writeFile(join(repo, '.agent-lab', 'exports', 'report.md'), [
      'artifact from /Users/example/Code/private-target',
      'Authorization: Bearer audit-token-value-1234567890',
      'private codename: release-sentinel',
      '',
    ].join('\n'));
    await writeFile(join(repo, '.agent-lab', 'privacy-blocklist.txt'), 'release-sentinel\n');

    const result = runAdl(repo, [
      'privacy',
      'audit',
      '--path',
      '.agent-lab/exports',
      '--json',
    ], { allowFailure: true });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'fail');
    assert.equal(report.findings.some((finding) => finding.kind === 'secret'), true);
    assert.equal(report.findings.some((finding) => finding.kind === 'local-path' && finding.severity === 'warn'), true);
    assert.equal(report.findings.some((finding) => finding.kind === 'blocklist'), true);
  } finally {
    await cleanup(repo);
  }
});

test('privacy audit scans public files without false positives for safe examples', async () => {
  const repo = await createTempGitRepo();
  try {
    await writeFile(join(repo, 'docs.md'), [
      'Use example.invalid addresses in documentation.',
      'Use /tmp/example as a placeholder path.',
      '',
    ].join('\n'));

    const result = runAdl(repo, ['privacy', 'audit', '--public-files', '--json']);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'ok');
    assert.deepEqual(report.findings, []);
  } finally {
    await cleanup(repo);
  }
});
