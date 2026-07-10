import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { cleanup, createTempGitRepo } from './helpers.js';
import { createUiServer } from '../src/ui.js';

test('UI server provides controls and realtime experiment state', async () => {
  const repo = await createTempGitRepo();
  const ui = await createUiServer(repo, { host: '127.0.0.1', port: 0 });
  try {
    const authorized = (path) => authorizedUrl(ui, path);
    const html = await fetchText(ui.launchUrl);
    assert.match(html, /Agent Decision Lab/);
    assert.match(html, /Init Case Study/);
    assert.match(html, /Create worktree/);
    assert.match(html, /Event Stream/);
    assert.match(html, /data-region="command-bar"/);
    assert.match(html, /data-region="route-board"/);
    assert.match(html, /data-region="decision-workspace"/);
    assert.match(html, /data-region="selected-route"/);
    assert.match(html, /data-region="activity-stream"/);
    assert.match(html, /id="responseBtn"/);
    assert.match(html, /id="checkpointBtn"/);
    assert.match(html, /id="promptBlock"/);
    assert.match(html, /id="message"/);
    assert.match(html, /role="status"/);
    assert.match(html, /function setMessage/);
    assert.match(html, /response\.ok/);
    assert.match(html, /result\.ok===false/);
    assert.match(html, /function esc/);
    assert.match(html, /esc\(e\.bodySummary\)/);
    assert.match(html, /esc\(v\.name\)/);

    const favicon = await fetch(`${ui.url}/favicon.ico`);
    assert.equal(favicon.status, 204);

    const before = await fetchJson(authorized('/api/state'));
    assert.equal(before.initialized, false);

    const invalidJson = await fetch(authorized('/api/log-note'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(invalidJson.status, 400);
    assert.match((await invalidJson.json()).error, /Invalid JSON/);

    const initialized = await postJson(authorized('/api/case-study-init'), {
      title: 'UI Lab',
      decision: 'Context strategy',
      savepoint: 'Before UI task',
      rationale: 'Exercise UI controls',
    });
    assert.equal(initialized.ok, true);

    const invalidVariant = await fetch(authorized('/api/variants'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'Before UI task' }),
    });
    assert.equal(invalidVariant.status, 200);
    assert.deepEqual(await invalidVariant.json(), {
      ok: false,
      error: 'Variant name is required',
    });

    const added = await postJson(authorized('/api/variants'), {
      name: 'docs-visible',
      from: 'Before UI task',
      contextPolicy: 'docs-visible',
      worktree: true,
    });
    assert.equal(added.variant.name, 'docs-visible');
    assert.match(added.variant.worktreePath, /docs[_-]visible/);

    const note = await postJson(authorized('/api/log-note'), {
      body: 'UI note',
      variant: 'docs-visible',
    });
    assert.equal(note.event.type, 'note');

    const response = await postJson(authorized('/api/log-response'), {
      body: 'UI response',
      variant: 'docs-visible',
    });
    assert.equal(response.event.type, 'response');

    const checkpoint = await postJson(authorized('/api/checkpoint'), {
      body: 'UI checkpoint',
      variant: 'docs-visible',
    });
    assert.equal(checkpoint.event.type, 'checkpoint');

    const prompt = await postJson(authorized('/api/orchestrate'), {
      variant: 'docs-visible',
    });
    assert.match(prompt.prompt, /docs-visible/);

    const exported = await postJson(authorized('/api/export'), { format: 'html' });
    assert.match(exported.out, /\.agent-lab\/exports\/ui-report\.html/);

    const after = await fetchJson(authorized('/api/state'));
    assert.equal(after.initialized, true);
    assert.equal(after.experiment.title, 'UI Lab');
    assert.equal(after.variants.some((variant) => variant.name === 'docs-visible'), true);
    assert.equal(after.variants.some((variant) => /docs[_-]visible/.test(variant.worktreePath ?? '')), true);
    assert.equal(after.events.some((event) => event.bodySummary === 'UI note'), true);

    const event = await readFirstServerSentEvent(authorized('/api/events'));
    assert.match(event, /"initialized":true/);
  } finally {
    await ui.close();
    await cleanup(repo);
  }
});

test('UI server close is idempotent', async () => {
  const repo = await createTempGitRepo();
  const ui = await createUiServer(repo, { host: '127.0.0.1', port: 0 });
  try {
    await ui.close();
    await ui.close();
  } finally {
    await cleanup(repo);
  }
});

test('UI server requires its launch token and rejects foreign or oversized writes', async () => {
  const repo = await createTempGitRepo();
  const ui = await createUiServer(repo, { host: '127.0.0.1', port: 0 });
  try {
    assert.equal(typeof ui.token, 'string');
    assert.equal(ui.token.length >= 32, true);

    const origin = new URL(ui.url).origin;
    assert.equal((await fetch(`${origin}/api/state`)).status, 401);

    const authorizedState = await fetch(`${origin}/api/state?token=${ui.token}`);
    assert.equal(authorizedState.status, 200);

    const foreignOrigin = await fetch(`${origin}/api/log-note?token=${ui.token}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://attacker.example.invalid',
      },
      body: JSON.stringify({ body: 'blocked' }),
    });
    assert.equal(foreignOrigin.status, 403);

    const oversized = await fetch(`${origin}/api/log-note?token=${ui.token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'x'.repeat(1024 * 1024) }),
    });
    assert.equal(oversized.status, 413);
  } finally {
    await ui.close();
    await cleanup(repo);
  }
});

async function fetchText(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return await response.text();
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return await response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  return await response.json();
}

async function readFirstServerSentEvent(url) {
  return await new Promise((resolve, reject) => {
    let body = '';
    let settled = false;
    const request = http.get(url, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
        if (!settled && body.includes('\n\n')) {
          settled = true;
          resolve(body);
          request.destroy();
        }
      });
    });
    request.on('error', (error) => {
      if (!settled) {
        reject(error);
      }
    });
    setTimeout(() => {
      if (!settled) {
        settled = true;
        request.destroy();
        reject(new Error('Timed out waiting for SSE'));
      }
    }, 2000).unref();
  });
}

function authorizedUrl(ui, path) {
  const url = new URL(path, ui.url);
  url.searchParams.set('token', ui.token);
  return url.toString();
}
