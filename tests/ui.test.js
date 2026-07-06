import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { cleanup, createTempGitRepo } from './helpers.js';
import { createUiServer } from '../src/ui.js';

test('UI server provides controls and realtime experiment state', async () => {
  const repo = await createTempGitRepo();
  const ui = await createUiServer(repo, { host: '127.0.0.1', port: 0 });
  try {
    const html = await fetchText(`${ui.url}/`);
    assert.match(html, /Agent Decision Lab/);
    assert.match(html, /Init Case Study/);
    assert.match(html, /Create worktree/);
    assert.match(html, /Event Stream/);
    assert.match(html, /function esc/);
    assert.match(html, /esc\(e\.bodySummary\)/);
    assert.match(html, /esc\(v\.name\)/);

    const favicon = await fetch(`${ui.url}/favicon.ico`);
    assert.equal(favicon.status, 204);

    const before = await fetchJson(`${ui.url}/api/state`);
    assert.equal(before.initialized, false);

    const initialized = await postJson(`${ui.url}/api/case-study-init`, {
      title: 'UI Lab',
      decision: 'Context strategy',
      savepoint: 'Before UI task',
      rationale: 'Exercise UI controls',
    });
    assert.equal(initialized.ok, true);

    const added = await postJson(`${ui.url}/api/variants`, {
      name: 'docs-visible',
      from: 'Before UI task',
      contextPolicy: 'docs-visible',
      worktree: true,
    });
    assert.equal(added.variant.name, 'docs-visible');
    assert.match(added.variant.worktreePath, /docs[_-]visible/);

    const note = await postJson(`${ui.url}/api/log-note`, {
      body: 'UI note',
      variant: 'docs-visible',
    });
    assert.equal(note.event.type, 'note');

    const exported = await postJson(`${ui.url}/api/export`, { format: 'html' });
    assert.match(exported.out, /\.agent-lab\/exports\/ui-report\.html/);

    const after = await fetchJson(`${ui.url}/api/state`);
    assert.equal(after.initialized, true);
    assert.equal(after.experiment.title, 'UI Lab');
    assert.equal(after.variants.some((variant) => variant.name === 'docs-visible'), true);
    assert.equal(after.variants.some((variant) => /docs[_-]visible/.test(variant.worktreePath ?? '')), true);
    assert.equal(after.events.some((event) => event.bodySummary === 'UI note'), true);

    const event = await readFirstServerSentEvent(`${ui.url}/api/events`);
    assert.match(event, /"initialized":true/);
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
