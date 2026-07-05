import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo, readJson } from './helpers.js';
import { slugify } from '../src/ids.js';
import {
  createExperimentStore,
  createNewExperimentStore,
  listExperimentStores,
  loadCurrentStore,
  switchExperimentStore,
} from '../src/store.js';

test('slugifies human titles into stable ids', () => {
  assert.equal(slugify('Improve Checkout Flow!'), 'improve_checkout_flow');
  assert.equal(slugify('  Context   Strategy  '), 'context_strategy');
});

test('initializes .agent-lab with experiment metadata and config', async () => {
  const repo = await createTempGitRepo();
  try {
    const experiment = await createExperimentStore(repo, {
      title: 'Improve Checkout Flow',
      description: 'Compare agent strategies',
      owner: 'example-user',
    });

    assert.match(experiment.id, /^exp_\d{8}_improve_checkout_flow/);
    assert.equal(experiment.title, 'Improve Checkout Flow');
    assert.equal(experiment.schemaVersion, 'agent-decision-lab/v1');
    assert.equal(experiment.privacy.classification, 'private');

    const config = await readJson(join(repo, '.agent-lab/config.json'));
    assert.equal(config.currentExperimentId, experiment.id);
    assert.equal(config.activeVariantId, null);

    const store = await loadCurrentStore(repo);
    assert.equal(store.experiment.id, experiment.id);
    assert.deepEqual(store.tree.nodes, []);
    assert.deepEqual(store.artifacts.artifacts, []);
    assert.equal(await readFile(join(store.paths.experimentDir, 'events.jsonl'), 'utf8'), '');
    await access(join(store.paths.experimentDir, 'variants'));
    await access(join(store.paths.experimentDir, 'exports'));
  } finally {
    await cleanup(repo);
  }
});

test('creates, lists, and switches between multiple experiments in one repo', async () => {
  const repo = await createTempGitRepo();
  try {
    const first = await createExperimentStore(repo, {
      title: 'First Lab',
    });
    const second = await createNewExperimentStore(repo, {
      title: 'Bald Patch Case Study',
    });

    assert.notEqual(first.id, second.id);
    assert.equal((await loadCurrentStore(repo)).experiment.id, second.id);

    const experiments = await listExperimentStores(repo);
    assert.deepEqual(
      experiments.map((experiment) => experiment.title).sort(),
      ['Bald Patch Case Study', 'First Lab'],
    );

    await switchExperimentStore(repo, 'First Lab');
    assert.equal((await loadCurrentStore(repo)).experiment.id, first.id);

    await switchExperimentStore(repo, second.id);
    assert.equal((await loadCurrentStore(repo)).experiment.id, second.id);
  } finally {
    await cleanup(repo);
  }
});
