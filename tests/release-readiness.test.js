import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectRoot, readJson } from './helpers.js';

test('package exposes release-ready metadata and verification scripts', async () => {
  const pkg = await readJson(join(projectRoot, 'package.json'));

  assert.equal(pkg.bin?.adl, './bin/adl.js');
  assert.equal(pkg.engines?.node, '>=22');
  assert.equal(pkg.scripts?.verify, 'npm test && npm run smoke && git diff --check && npm pack --dry-run');
  assert.equal(pkg.repository?.type, 'git');
  assert.match(pkg.repository?.url ?? '', /agent-decision-lab/);
  assert.deepEqual(pkg.files, [
    'AGENTS.md',
    'LICENSE',
    'README.md',
    'bin/',
    'docs/',
    'src/',
  ]);
});

test('CI runs the same release verification command', async () => {
  const ci = await readFile(join(projectRoot, '.github/workflows/ci.yml'), 'utf8');

  assert.match(ci, /npm run verify/);
  assert.match(ci, /node-version: 22/);
});

test('gitignore protects private experiment data and local package artifacts', async () => {
  const gitignore = await readFile(join(projectRoot, '.gitignore'), 'utf8');

  assert.match(gitignore, /^\.agent-lab\/$/m);
  assert.match(gitignore, /^\.npm-cache\/$/m);
  assert.match(gitignore, /^node_modules\/$/m);
  assert.match(gitignore, /^\*\.tgz$/m);
});

test('release checklist documents privacy and live-case gates', async () => {
  const release = await readFile(join(projectRoot, 'docs/release-readiness.md'), 'utf8');

  assert.match(release, /npm run verify/);
  assert.match(release, /case-study workflow/i);
  assert.match(release, /no-score/i);
  assert.match(release, /worktree lifecycle/i);
  assert.match(release, /dashboard-style HTML/i);
  assert.match(release, /local filesystem paths/i);
});

test('production onboarding and v0.1.0 release docs are linked and complete', async () => {
  const readme = await readFile(join(projectRoot, 'README.md'), 'utf8');
  const onboarding = await readFile(join(projectRoot, 'docs/onboarding.md'), 'utf8');
  const releaseNotes = await readFile(join(projectRoot, 'docs/releases/v0.1.0.md'), 'utf8');
  const caseStudy = await readFile(join(projectRoot, 'docs/examples/reality-slap-skill-case-study.md'), 'utf8');
  const ui = await readFile(join(projectRoot, 'docs/ui.md'), 'utf8');

  assert.match(readme, /Onboarding/);
  assert.match(readme, /Realtime UI/);
  assert.match(onboarding, /adl doctor/);
  assert.match(onboarding, /adapter scaffold/);
  assert.match(onboarding, /plugin scaffold/);
  assert.match(releaseNotes, /v0\.1\.0/);
  assert.match(releaseNotes, /GitHub Release/);
  assert.match(releaseNotes, /No npm publish/);
  assert.match(caseStudy, /Reality Slap Skill/);
  assert.match(caseStudy, /no-score/i);
  assert.match(caseStudy, /redacted/i);
  assert.match(ui, /adl ui/);
  assert.match(ui, /EventSource/);
  assert.match(ui, /Init Case Study/);
  assert.match(ui, /Add Variant/);
});
