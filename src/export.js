import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { redactText } from './redact.js';
import { renderTree } from './render.js';
import { renderMermaid } from './graph.js';
import { loadCurrentStore } from './store.js';
import { renderSvg } from './svg.js';

export async function exportExperiment(repoPath, options = {}) {
  const format = options.format ?? 'json';
  const includePrivate = options.includePrivate ?? false;
  const redact = options.redact ?? true;
  const store = await loadCurrentStore(repoPath);

  if (format === 'markdown') {
    const markdown = await renderMarkdown(repoPath, store, { includePrivate, redact });
    if (options.out) {
      await writeOutput(repoPath, options.out, markdown);
    }
    return markdown;
  }

  if (format === 'mermaid') {
    const mermaid = await renderMermaid(repoPath);
    if (options.out) {
      await writeOutput(repoPath, options.out, mermaid);
    }
    return mermaid;
  }

  if (format === 'svg') {
    const svg = renderSvg(store);
    if (options.out) {
      await writeOutput(repoPath, options.out, svg);
    }
    return svg;
  }

  if (format !== 'json') {
    throw new Error(`Unsupported export format: ${format}`);
  }

  const bundle = buildJsonBundle(store, { includePrivate, redact });
  if (options.out) {
    await writeOutput(repoPath, options.out, `${JSON.stringify(bundle, null, 2)}\n`);
  }
  return bundle;
}

function buildJsonBundle(store, options) {
  return {
    schemaVersion: store.experiment.schemaVersion,
    exportedAt: new Date().toISOString(),
    experiment: cleanObject(store.experiment, options),
    privacy: {
      classification: store.experiment.privacy?.classification ?? 'private',
      redactionProfile: options.redact ? 'default' : 'none',
      redactionApplied: options.redact,
      includeEventBodies: options.includePrivate,
    },
    tree: cleanObject(store.tree, options),
    savepoints: store.savepoints.map((savepoint) => cleanObject(savepoint, options)),
    variants: store.variants.map((variant) => cleanObject(variant, options)),
    strategies: store.strategies.map((strategy) => cleanObject(strategy, options)),
    evaluations: store.evaluations.map((evaluation) => cleanObject(evaluation, options)),
    comparisons: store.comparisons.map((comparison) => cleanObject(comparison, options)),
    guidanceDrafts: store.guidanceDrafts.map((guidance) => cleanObject(guidance, options)),
    events: store.events.map((event) => exportEvent(event, options)),
    artifacts: cleanObject(store.artifacts, options),
  };
}

function exportEvent(event, options) {
  const exported = {
    id: event.id,
    type: event.type,
    experimentId: event.experimentId,
    variantId: event.variantId,
    createdAt: event.createdAt,
    actor: event.actor,
    metadata: cleanObject(event.metadata, options),
  };

  const body = options.redact ? redactText(event.body) : event.body;
  if (options.includePrivate) {
    exported.body = body;
  } else {
    exported.bodySummary = summarize(body);
  }

  return exported;
}

async function renderMarkdown(repoPath, store, options) {
  const tree = await renderTree(repoPath);
  const lines = [
    `# ${safeText(store.experiment.title, options)}`,
    '',
    '## Summary',
    '',
    `- Experiment ID: ${store.experiment.id}`,
    `- Created: ${store.experiment.createdAt}`,
    `- Privacy: ${store.experiment.privacy?.classification ?? 'private'}`,
    `- Redaction applied: ${options.redact ? 'yes' : 'no'}`,
    `- Event bodies included: ${options.includePrivate ? 'yes' : 'no'}`,
    '',
    '## Decision Tree',
    '',
    '```text',
    tree.trimEnd(),
    '```',
    '',
    '## Variant Comparison',
    '',
    '| Variant | Decision | Branch | Worktree | Status |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const variant of store.variants) {
    lines.push(`| ${safeText(variant.name, options)} | ${variant.decisionId} | ${safeText(variant.branch, options)} | ${variant.worktreePath ? safeText(variant.worktreePath, options) : ''} | ${variant.status} |`);
  }

  lines.push('', '## Savepoints', '');
  if (store.savepoints.length === 0) {
    lines.push('- No savepoints recorded.');
  } else {
    for (const savepoint of store.savepoints) {
      lines.push(`- ${savepoint.title} (${savepoint.id}) at ${savepoint.git.commit.slice(0, 12)}`);
    }
  }

  lines.push('', '## Events', '');
  if (store.events.length === 0) {
    lines.push('- No events recorded.');
  } else {
    for (const event of store.events) {
      const body = options.includePrivate ? ` - ${safeText(event.body, options)}` : '';
      lines.push(`- ${event.createdAt} ${event.type} (${event.variantId ?? 'no variant'})${body}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function cleanObject(value, options) {
  if (typeof value === 'string') {
    return safeText(value, options);
  }
  if (Array.isArray(value)) {
    return value.map((item) => cleanObject(item, options));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cleanObject(item, options)]),
    );
  }
  return value;
}

function safeText(value, options) {
  return options.redact ? redactText(value) : value;
}

function summarize(value) {
  const collapsed = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 120) {
    return collapsed;
  }
  return `${collapsed.slice(0, 117)}...`;
}

async function writeOutput(repoPath, out, body) {
  const outputPath = resolve(repoPath, out);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, body);
}
