import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo, runAdl } from './helpers.js';

test('doctor reports git lab and privacy readiness', async () => {
  const repo = await createTempGitRepo();
  try {
    const beforeInit = runAdl(repo, ['doctor']);
    assert.equal(beforeInit.status, 0);
    assert.match(beforeInit.stdout, /Git repository: ok/);
    assert.match(beforeInit.stdout, /ADL experiment: warn/);
    assert.match(beforeInit.stdout, /Private lab ignore: warn/);

    await writeFile(join(repo, '.gitignore'), '.agent-lab/\n');
    assert.equal(runAdl(repo, ['init', 'Doctor Lab']).status, 0);

    const afterInit = runAdl(repo, ['doctor']);
    assert.equal(afterInit.status, 0);
    assert.match(afterInit.stdout, /ADL experiment: ok/);
    assert.match(afterInit.stdout, /Private lab ignore: ok/);
    assert.match(afterInit.stdout, /Dirty files outside lab: warn/);

    const asJson = runAdl(repo, ['doctor', '--json']);
    assert.equal(asJson.status, 0);
    const parsed = JSON.parse(asJson.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.checks.some((check) => check.id === 'git-repository'), true);
  } finally {
    await cleanup(repo);
  }
});

test('doctor honors Git exclude rules for private lab ignore', async () => {
  const repo = await createTempGitRepo();
  try {
    await writeFile(join(repo, '.git/info/exclude'), '.agent-lab/\n');

    const result = runAdl(repo, ['doctor']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Private lab ignore: ok/);
  } finally {
    await cleanup(repo);
  }
});
