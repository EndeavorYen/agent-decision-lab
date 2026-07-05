import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, createTempGitRepo } from './helpers.js';
import { appendEvent } from '../src/events.js';
import { exportExperiment } from '../src/export.js';
import { redactText } from '../src/redact.js';
import { renderTree } from '../src/render.js';
import { createDecision, createExperimentStore, startVariant } from '../src/store.js';

async function createPopulatedExperiment() {
  const repo = await createTempGitRepo();
  await createExperimentStore(repo, { title: 'Checkout Lab' });
  const decision = await createDecision(repo, {
    title: 'Context strategy',
    rationale: 'Compare context policies',
  });
  await startVariant(repo, {
    name: 'guidance-first',
    decision: decision.id,
    createBranch: true,
  });
  return repo;
}

test('redacts common sensitive strings', () => {
  const redacted = redactText([
    'Authorization: Bearer fake-token-for-redaction-test',
    'password = "correct horse battery staple"',
    '-----BEGIN PRIVATE KEY----- secret -----END PRIVATE KEY-----',
  ].join('\n'));

  assert.doesNotMatch(redacted, /fake-token-for-redaction-test/);
  assert.doesNotMatch(redacted, /correct horse battery staple/);
  assert.doesNotMatch(redacted, /secret/);
  assert.match(redacted, /\[REDACTED/);
});

test('exports a redacted summary JSON bundle', async () => {
  const repo = await createPopulatedExperiment();
  try {
    await appendEvent(repo, {
      type: 'prompt',
      body: 'Use bearer token Bearer fake-token-for-redaction-test',
      actor: 'human',
    });

    const bundle = await exportExperiment(repo, {
      format: 'json',
      includePrivate: false,
      redact: true,
    });

    assert.equal(bundle.privacy.includeEventBodies, false);
    assert.equal(bundle.privacy.redactionApplied, true);
    assert.equal(bundle.events[0].body, undefined);
    assert.doesNotMatch(JSON.stringify(bundle), /fake-token-for-redaction-test/);
    assert.equal(bundle.variants.length, 1);
  } finally {
    await cleanup(repo);
  }
});

test('renders a readable decision tree and markdown export', async () => {
  const repo = await createPopulatedExperiment();
  try {
    await appendEvent(repo, {
      type: 'checkpoint',
      body: 'Design approved',
      actor: 'human',
    });

    const tree = await renderTree(repo);
    assert.match(tree, /Checkout Lab/);
    assert.match(tree, /Context strategy/);
    assert.match(tree, /guidance-first/);

    const markdown = await exportExperiment(repo, {
      format: 'markdown',
      includePrivate: false,
      redact: true,
    });
    assert.match(markdown, /# Checkout Lab/);
    assert.match(markdown, /## Decision Tree/);
    assert.match(markdown, /guidance-first/);
  } finally {
    await cleanup(repo);
  }
});
