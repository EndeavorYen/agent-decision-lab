import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { adlBin, projectRoot, readJson, run } from './helpers.js';

test('package exposes release-ready metadata and verification scripts', async () => {
  const pkg = await readJson(join(projectRoot, 'package.json'));

  assert.equal(pkg.version, '0.2.0');
  assert.equal(pkg.bin?.adl, './bin/adl.js');
  assert.equal(pkg.engines?.node, '>=22');
  assert.equal(pkg.scripts?.coverage, 'node --test --experimental-test-coverage tests/*.test.js');
  assert.equal(pkg.scripts?.privacy, 'node bin/adl.js privacy audit --public-files --json');
  assert.equal(pkg.scripts?.verify, 'npm test && npm run smoke && npm run privacy && git diff --check && npm pack --dry-run');
  assert.equal(pkg.repository?.type, 'git');
  assert.match(pkg.repository?.url ?? '', /agent-decision-lab/);
  assert.match(pkg.homepage ?? '', /agent-decision-lab/);
  assert.match(pkg.bugs?.url ?? '', /issues/);
  assert.deepEqual(pkg.files, [
    'LICENSE',
    'README.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'bin/',
    'docs/',
    'src/',
  ]);
  const version = run(process.execPath, [adlBin, '--version'], projectRoot);
  assert.equal(version.stdout.trim(), '0.2.0');
});

test('CI runs the same release verification command', async () => {
  const ci = await readFile(join(projectRoot, '.github/workflows/ci.yml'), 'utf8');

  assert.match(ci, /npm run verify/);
  assert.match(ci, /ubuntu-latest/);
  assert.match(ci, /macos-latest/);
  assert.match(ci, /22/);
  assert.match(ci, /lts\/\*/);
  assert.match(ci, /node-version:.*matrix\.node/);
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

test('production onboarding and v0.2.0 release docs are linked and complete', async () => {
  const readme = await readFile(join(projectRoot, 'README.md'), 'utf8');
  const onboarding = await readFile(join(projectRoot, 'docs/onboarding.md'), 'utf8');
  const releaseNotes = await readFile(join(projectRoot, 'docs/releases/v0.2.0.md'), 'utf8');
  const caseStudy = await readFile(join(projectRoot, 'docs/examples/reality-slap-skill-case-study.md'), 'utf8');
  const ui = await readFile(join(projectRoot, 'docs/ui.md'), 'utf8');
  const changelog = await readFile(join(projectRoot, 'CHANGELOG.md'), 'utf8');
  const contributing = await readFile(join(projectRoot, 'CONTRIBUTING.md'), 'utf8');
  const security = await readFile(join(projectRoot, 'SECURITY.md'), 'utf8');
  const roadmap = await readFile(join(projectRoot, 'docs/roadmap.md'), 'utf8');
  const design = await readFile(join(projectRoot, 'docs/design.md'), 'utf8');
  const requirements = await readFile(join(projectRoot, 'docs/product-requirements.md'), 'utf8');

  assert.match(readme, /Onboarding/);
  assert.match(readme, /Realtime UI/);
  assert.match(onboarding, /adl doctor/);
  assert.match(onboarding, /adapter scaffold/);
  assert.match(onboarding, /plugin scaffold/);
  assert.match(onboarding, /adl migrate --dry-run/);
  assert.match(onboarding, /adl repair --dry-run/);
  assert.match(releaseNotes, /v0\.2\.0/);
  assert.match(releaseNotes, /transactional/i);
  assert.match(releaseNotes, /migration/i);
  assert.match(releaseNotes, /repair --dry-run/i);
  assert.match(releaseNotes, /No npm publish/i);
  assert.match(caseStudy, /Reality Slap Skill/);
  assert.match(caseStudy, /no-score/i);
  assert.match(caseStudy, /redacted/i);
  assert.match(ui, /adl ui/);
  assert.match(ui, /EventSource/);
  assert.match(ui, /Init Case Study/);
  assert.match(ui, /Add Variant/);
  assert.match(ui, /launch token/i);
  assert.match(changelog, /0\.2\.0/);
  assert.match(contributing, /npm run verify/);
  assert.match(security, /security/i);
  assert.match(roadmap, /Phase 10: Reliability and Recovery/);
  assert.doesNotMatch(roadmap, /- SVG visual renderer\./);
  assert.match(design, /lab-scoped writer lock/i);
  assert.match(design, /operation journal/i);
  assert.match(requirements, /parallel metadata writers/i);
});
