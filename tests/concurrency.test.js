import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanup, createTempGitRepo } from './helpers.js';
import { appendEvent } from '../src/events.js';
import {
  createDecision,
  createExperimentStore,
  loadCurrentStore,
} from '../src/store.js';
import { withLabLock } from '../src/transaction.js';

test('serializes concurrent decision writers without corruption or lost records', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Concurrent Decisions' });

    await Promise.all(Array.from({ length: 20 }, (_, index) => (
      createDecision(repo, { title: `decision-${index}` })
    )));

    const store = await loadCurrentStore(repo);
    const decisions = store.tree.nodes.filter((node) => node.type === 'decision');
    assert.equal(decisions.length, 20);
    assert.equal(new Set(decisions.map((decision) => decision.id)).size, 20);
  } finally {
    await cleanup(repo);
  }
});

test('serializes concurrent event writers without losing JSONL records', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Concurrent Events' });

    await Promise.all(Array.from({ length: 20 }, (_, index) => (
      appendEvent(repo, { type: 'note', body: `event-${index}` })
    )));

    const store = await loadCurrentStore(repo);
    assert.equal(store.events.length, 20);
    assert.equal(new Set(store.events.map((event) => event.body)).size, 20);
  } finally {
    await cleanup(repo);
  }
});

test('does not reclaim an old lock while its owner process is still alive', async () => {
  const repo = await createTempGitRepo();
  let active = 0;
  let maximumActive = 0;
  try {
    const enter = async (holdMs) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, holdMs));
      active -= 1;
    };
    const first = withLabLock(repo, () => enter(100), { staleMs: 20, timeoutMs: 500 });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = withLabLock(repo, () => enter(0), { staleMs: 20, timeoutMs: 500 });
    await Promise.all([first, second]);

    assert.equal(maximumActive, 1);
  } finally {
    await cleanup(repo);
  }
});

test('reclaims an old lock when owner metadata was never written', async () => {
  const repo = await createTempGitRepo();
  try {
    const lockDir = join(repo, '.agent-lab', '.write-lock');
    await mkdir(lockDir, { recursive: true });
    const old = new Date(Date.now() - 1_000);
    await utimes(lockDir, old, old);

    let acquired = false;
    await withLabLock(repo, async () => {
      acquired = true;
    }, { staleMs: 20, timeoutMs: 200 });

    assert.equal(acquired, true);
  } finally {
    await cleanup(repo);
  }
});
