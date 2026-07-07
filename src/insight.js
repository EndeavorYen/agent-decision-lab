import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { redactText } from './redact.js';
import { findVariant, loadCurrentStore } from './store.js';

export const insightSchemaVersion = 'agent-decision-lab/insight-pack/v1';

export async function exportInsightPack(repoPath, options = {}) {
  const store = await loadCurrentStore(repoPath);
  const includePrivate = options.includePrivate === true;
  const redact = options.redact !== false;
  const variants = selectVariants(store, options.variants);
  const variantIds = new Set(variants.map((variant) => variant.id));
  const events = store.events
    .filter((event) => !event.variantId || variantIds.has(event.variantId))
    .toSorted((a, b) => `${a.createdAt}:${a.id}`.localeCompare(`${b.createdAt}:${b.id}`));
  const pack = {
    schemaVersion: insightSchemaVersion,
    privacy: {
      mode: includePrivate ? 'private' : 'redacted',
      redactionApplied: redact,
      includePrivateBodies: includePrivate,
      rawPromptResponseBodiesIncluded: includePrivate,
    },
    redaction: {
      profile: redact ? 'default' : 'none',
      applied: redact,
      notes: [
        'Default insight packs omit raw prompt and response bodies.',
        'Local paths and secret-like values are redacted when redaction is enabled.',
      ],
    },
    experiment: cleanObject({
      id: store.experiment.id,
      title: store.experiment.title,
      description: store.experiment.description,
      privacy: store.experiment.privacy,
    }, { redact }),
    structure: {
      decisions: store.tree.nodes.filter((node) => node.type === 'decision').map((node) => cleanObject(node, { redact })),
      savepoints: store.savepoints.map((savepoint) => cleanObject(savepoint, { redact })),
    },
    variants: variants.map((variant) => cleanObject(variantSummary(store, variant), { redact })),
    timeline: events.map((event) => insightEvent(event, { includePrivate, redact })),
    commandOutcomes: events
      .filter((event) => event.type === 'command')
      .map((event) => cleanObject(commandOutcome(store, event, { redact }), { redact })),
    artifacts: store.artifacts.artifacts
      .filter((artifact) => !artifact.variantId || variantIds.has(artifact.variantId))
      .map((artifact) => cleanObject(artifact, { redact })),
    evaluations: store.evaluations
      .filter((evaluation) => variantIds.has(evaluation.variantId))
      .map((evaluation) => cleanObject(evaluation, { redact })),
    comparisons: store.comparisons
      .filter((comparison) => comparison.variants?.some((variant) => variantIds.has(variant.id)))
      .map((comparison) => cleanObject(comparisonSummary(comparison), { redact })),
    missingEvidenceWarnings: missingEvidenceWarnings(store, variants, events),
  };

  if (options.out) {
    const outputPath = resolve(repoPath, options.out);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(pack, null, 2)}\n`);
  }
  return pack;
}

function selectVariants(store, values) {
  const requested = listOption(values);
  if (requested.length === 0) {
    return store.variants;
  }
  return requested.map((value) => {
    const variant = findVariant(store, value);
    if (!variant) {
      throw new Error(`Variant not found: ${value}`);
    }
    return variant;
  });
}

function variantSummary(store, variant) {
  return {
    id: variant.id,
    name: variant.name,
    branch: variant.branch,
    worktreePath: variant.worktreePath,
    savepointId: variant.savepointId,
    status: variant.status,
    strategy: store.strategies.find((strategy) => strategy.variantId === variant.id) ?? null,
  };
}

function insightEvent(event, options) {
  const record = {
    id: event.id,
    type: event.type,
    variantId: event.variantId,
    createdAt: event.createdAt,
    actor: event.actor,
    metadata: cleanObject(event.metadata ?? {}, options),
    bodySummary: summarizeEvent(event, options),
  };
  if (options.includePrivate) {
    record.body = safeText(event.body, options);
  }
  return record;
}

function commandOutcome(store, event, options) {
  const variant = store.variants.find((record) => record.id === event.variantId);
  const metadata = event.metadata ?? {};
  return {
    eventId: event.id,
    variant: variant?.name ?? event.variantId ?? null,
    command: metadata.command ?? null,
    status: metadata.status ?? metadata.exitCode ?? null,
    signal: metadata.signal ?? null,
    durationMs: metadata.durationMs ?? null,
    summary: summarizeText(event.body, options),
  };
}

function comparisonSummary(comparison) {
  return {
    id: comparison.id,
    rubricId: comparison.rubricId,
    savepointId: comparison.savepointId,
    variants: comparison.variants?.map((variant) => ({
      id: variant.id,
      name: variant.name,
      totalScore: variant.totalScore,
      scoreLabel: variant.scoreLabel,
    })) ?? [],
    warnings: comparison.warnings ?? [],
    judgment: comparison.judgment,
  };
}

function missingEvidenceWarnings(store, variants, events) {
  const warnings = [];
  for (const variant of variants) {
    const hasEvaluation = store.evaluations.some((evaluation) => evaluation.variantId === variant.id);
    const hasCommand = events.some((event) => event.variantId === variant.id && event.type === 'command');
    if (!hasEvaluation) {
      warnings.push({
        variant: variant.name,
        kind: 'missing-evaluation',
        message: `${variant.name} has no recorded evaluation.`,
      });
    }
    if (!hasCommand) {
      warnings.push({
        variant: variant.name,
        kind: 'missing-command-evidence',
        message: `${variant.name} has no recorded command evidence.`,
      });
    }
  }
  return warnings;
}

function summarizeEvent(event, options) {
  if (event.type === 'command') {
    return summarizeText(event.body, options);
  }
  const length = String(event.body ?? '').length;
  return `${event.type} body omitted (${length} chars)`;
}

function summarizeText(value, options) {
  const collapsed = safeText(value, options).replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 180) {
    return collapsed;
  }
  return `${collapsed.slice(0, 177)}...`;
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
  return options.redact ? redactText(value) : String(value ?? '');
}

function listOption(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(listOption);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
