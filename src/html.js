import { redactText } from './redact.js';
import { renderSvg } from './svg.js';

export function renderHtml(store, options = {}) {
  const safe = (value) => escapeHtml(options.redact === false ? value : redactText(value));
  const svg = renderSvg(store, { redact: options.redact });
  const lines = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${safe(store.experiment.title)} · Agent Decision Lab</title>`,
    '<style>',
    'body{margin:0;font-family:Arial,sans-serif;color:#1f2933;background:#f7f8fb;}',
    'header{padding:24px 32px;background:#18212f;color:white;}',
    'main{padding:24px 32px;}',
    '.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 22px;}',
    '.metric{background:white;border:1px solid #d9dee7;border-radius:8px;padding:12px;}',
    '.metric strong{display:block;font-size:24px;}',
    '.visual{overflow:auto;background:white;border:1px solid #d9dee7;border-radius:8px;padding:12px;}',
    'details{background:white;border:1px solid #d9dee7;border-radius:8px;margin:16px 0;padding:12px;}',
    'summary{font-weight:700;cursor:pointer;}',
    'table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px;}',
    'th,td{border-bottom:1px solid #e3e7ee;padding:8px;text-align:left;vertical-align:top;}',
    'th{background:#f0f3f7;}',
    'code{font-family:Menlo,Consolas,monospace;font-size:12px;}',
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    `<h1>${safe(store.experiment.title)}</h1>`,
    `<p><code>${safe(store.experiment.id)}</code></p>`,
    '</header>',
    '<main>',
    '<section class="summary" aria-label="Experiment summary">',
    metric('Decisions', countNodes(store, 'decision')),
    metric('Savepoints', countNodes(store, 'savepoint')),
    metric('Variants', countNodes(store, 'variant')),
    metric('Evaluations', store.evaluations.length),
    metric('Comparisons', store.comparisons.length),
    metric('Events', store.events.length),
    '</section>',
    '<section class="visual">',
    '<h2>Decision Tree</h2>',
    svg,
    '</section>',
    details('Variants', variantTable(store, safe)),
    details('Comparisons', comparisonTable(store, safe)),
    details('Guidance Drafts', guidanceTable(store, safe)),
    details('Recent Events', eventTable(store, safe, options)),
    '</main>',
    '</body>',
    '</html>',
  ];
  return `${lines.join('\n')}\n`;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function details(title, body) {
  return `<details open><summary>${escapeHtml(title)}</summary>${body}</details>`;
}

function variantTable(store, safe) {
  const rows = store.variants.map((variant) => {
    const evaluation = store.evaluations.find((record) => record.variantId === variant.id);
    const score = evaluation ? totalScore(evaluation) : '';
    return `<tr><td>${safe(variant.name)}</td><td><code>${safe(variant.branch)}</code></td><td>${safe(variant.savepointId ?? '')}</td><td>${score}</td></tr>`;
  });
  return table(['Variant', 'Branch', 'Savepoint', 'Score'], rows);
}

function comparisonTable(store, safe) {
  const rows = store.comparisons.map((comparison) => (
    `<tr><td><code>${safe(comparison.id)}</code></td><td>${safe(comparison.judgment)}</td><td>${comparison.warnings.length}</td></tr>`
  ));
  return table(['Comparison', 'Judgment', 'Warnings'], rows);
}

function guidanceTable(store, safe) {
  const rows = store.guidanceDrafts.map((guidance) => (
    `<tr><td><code>${safe(guidance.comparisonId)}</code></td><td>${safe(firstMeaningfulLine(guidance.markdown))}</td></tr>`
  ));
  return table(['Comparison', 'First Recommendation'], rows);
}

function eventTable(store, safe, options) {
  const rows = store.events.slice(-20).map((event) => {
    const body = options.includePrivate ? event.body : summarize(event.body);
    return `<tr><td>${safe(event.createdAt)}</td><td>${safe(event.type)}</td><td>${safe(event.variantId ?? '')}</td><td>${safe(body)}</td></tr>`;
  });
  return table(['Time', 'Type', 'Variant', 'Body'], rows);
}

function table(headers, rows) {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const body = rows.length > 0
    ? rows.join('\n')
    : `<tr><td colspan="${headers.length}">No records.</td></tr>`;
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function countNodes(store, type) {
  return store.tree.nodes.filter((node) => node.type === type).length;
}

function totalScore(evaluation) {
  return Object.values(evaluation.scores).reduce((sum, score) => sum + score, 0);
}

function firstMeaningfulLine(markdown) {
  return String(markdown ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('- '))
    ?? '';
}

function summarize(value) {
  const collapsed = String(value ?? '').replace(/\s+/g, ' ').trim();
  return collapsed.length <= 120 ? collapsed : `${collapsed.slice(0, 117)}...`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
