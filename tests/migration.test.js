import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo } from './helpers.js';
import { migrateLabStore } from '../src/migration.js';
import { createExperimentStore, loadCurrentStore } from '../src/store.js';

const v1 = 'agent-decision-lab/v1';
const v2 = 'agent-decision-lab/v2';

test('dry-runs and applies an explicit v1 to v2 store migration', async () => {
  const repo = await createTempGitRepo();
  try {
    const experiment = await createExperimentStore(repo, { title: 'Migration Lab' });
    const paths = corePaths(repo, experiment.id);
    for (const path of paths) {
      const document = JSON.parse(await readFile(path, 'utf8'));
      document.schemaVersion = v1;
      delete document.revision;
      await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
    }

    const dryRun = await migrateLabStore(repo, { dryRun: true });
    assert.equal(dryRun.from, v1);
    assert.equal(dryRun.to, v2);
    assert.equal(dryRun.changedFiles.length, 4);
    assert.equal(JSON.parse(await readFile(paths[0], 'utf8')).schemaVersion, v1);

    const applied = await migrateLabStore(repo);
    assert.equal(applied.changedFiles.length, 4);
    for (const path of paths) {
      const document = JSON.parse(await readFile(path, 'utf8'));
      assert.equal(document.schemaVersion, v2);
      assert.equal(document.revision, 0);
    }
  } finally {
    await cleanup(repo);
  }
});

test('fails closed for unsupported future schemas', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Future Lab' });
    const configPath = join(repo, '.agent-lab', 'config.json');
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    config.schemaVersion = 'agent-decision-lab/v99';
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

    await assert.rejects(
      () => loadCurrentStore(repo),
      /Unsupported schema version agent-decision-lab\/v99/,
    );
  } finally {
    await cleanup(repo);
  }
});

test('fails closed for malformed store documents', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Malformed Lab' });
    const configPath = join(repo, '.agent-lab', 'config.json');
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    delete config.currentExperimentId;
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

    await assert.rejects(
      () => loadCurrentStore(repo),
      /Invalid config: currentExperimentId must be a non-empty string/,
    );
  } finally {
    await cleanup(repo);
  }
});

function corePaths(repo, experimentId) {
  const experimentDir = join(repo, '.agent-lab', 'experiments', experimentId);
  return [
    join(repo, '.agent-lab', 'config.json'),
    join(experimentDir, 'experiment.json'),
    join(experimentDir, 'tree.json'),
    join(experimentDir, 'artifacts.json'),
  ];
}
