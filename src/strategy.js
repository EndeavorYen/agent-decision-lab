import { join } from 'node:path';
import { makeNodeId } from './ids.js';
import { bumpRevision } from './schema.js';
import {
  findSavepoint,
  findVariant,
  readJson,
  withCurrentStoreLock,
  writeJson,
} from './store.js';

const defaultRubric = {
  id: 'code-review-rule-quality',
  title: 'Code Review Rule Quality',
  criteria: [
    'alignment',
    'specificity',
    'signalToNoise',
    'riskCoverage',
    'maintainability',
    'lowOverfitRisk',
    'evidenceQuality',
  ],
};

export async function setStrategy(repoPath, input) {
  return withCurrentStoreLock(repoPath, async (store) => {
  const variant = findVariant(store, input.variant);
  if (!variant) {
    throw new Error(`Variant not found: ${input.variant}`);
  }
  const savepoint = findSavepoint(store, input.from ?? input.savepoint ?? variant.savepointId);
  if (!savepoint) {
    throw new Error(`Savepoint not found: ${input.from ?? input.savepoint ?? variant.savepointId}`);
  }

  const strategy = {
    id: makeNodeId('strat', variant.name),
    variantId: variant.id,
    savepointId: savepoint.id,
    label: input.label ?? variant.name,
    contextPolicy: input.contextPolicy ?? 'unspecified',
    promptPolicy: input.promptPolicy ?? 'unspecified',
    visibleContext: asList(input.visibleContext),
    withheldContext: asList(input.withheldContext),
    hypothesis: input.hypothesis ?? '',
    risks: asList(input.risks ?? input.risk),
    controls: asList(input.controls),
    createdAt: new Date().toISOString(),
  };

  await writeJson(join(store.paths.strategiesDir, `${variant.id}.json`), strategy);
  return strategy;
  });
}

export async function addArtifact(repoPath, input) {
  return withCurrentStoreLock(repoPath, async (store) => {
  const variant = input.variant ? findVariant(store, input.variant) : null;
  if (input.variant && !variant) {
    throw new Error(`Variant not found: ${input.variant}`);
  }

  const artifact = {
    id: input.id ?? makeNodeId('art', input.path ?? input.summary ?? 'artifact'),
    variantId: variant?.id ?? null,
    path: input.path ?? '',
    classification: input.classification ?? 'private',
    visibleToAgent: input.visibleToAgent ?? false,
    summary: input.summary ?? '',
    createdAt: new Date().toISOString(),
  };

  const artifacts = store.artifacts.artifacts.filter((existing) => existing.id !== artifact.id);
  artifacts.push(artifact);
  store.artifacts.artifacts = artifacts;
  bumpRevision(store.artifacts);
  await writeJson(store.paths.artifactsPath, store.artifacts);
  return artifact;
  });
}

export async function evaluateVariant(repoPath, input) {
  return withCurrentStoreLock(repoPath, async (store) => {
  const variant = findVariant(store, input.variant);
  if (!variant) {
    throw new Error(`Variant not found: ${input.variant}`);
  }
  const rubric = await ensureRubric(store, input.rubric ?? defaultRubric.id);
  const noScore = input.noScore === true;
  const scores = noScore ? {} : input.scores ?? {};
  for (const [criterion, score] of Object.entries(scores)) {
    if (typeof score !== 'number' || score < 1 || score > 5) {
      throw new Error(`Rubric score ${criterion} must be between 1 and 5`);
    }
  }

  const evaluation = {
    id: `${variant.id}--${rubric.id}`,
    variantId: variant.id,
    rubricId: rubric.id,
    noScore,
    scores,
    strengths: asList(input.strengths),
    weaknesses: asList(input.weaknesses),
    notableBehaviors: asList(input.notableBehaviors),
    evidence: asList(input.evidence),
    reviewer: input.reviewer ?? 'human',
    createdAt: new Date().toISOString(),
  };

  await writeJson(join(store.paths.evaluationsDir, `${evaluation.id}.json`), evaluation);
  return evaluation;
  });
}

export async function ensureRubric(store, rubricId) {
  const id = normalizeRecordId(rubricId);
  const path = join(store.paths.rubricsDir, `${id}.json`);
  const existing = store.rubrics.find((rubric) => rubric.id === id);
  if (existing) {
    return existing;
  }
  const rubric = id === defaultRubric.id ? defaultRubric : {
    id,
    title: rubricId,
    criteria: [],
  };
  await writeJson(path, rubric);
  return rubric;
}

export function normalizeRecordId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'untitled';
}

export async function readComparison(store, value) {
  const id = normalizeRecordId(value);
  const comparison = store.comparisons.find((record) => (
    record.id === value || record.id === `cmp_${id}` || normalizeRecordId(record.id) === id
  ));
  if (comparison) {
    return comparison;
  }
  return readJson(join(store.paths.comparisonsDir, `${value}.json`));
}

function asList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined && item !== null && item !== '');
  }
  if (value === undefined || value === null || value === '') {
    return [];
  }
  return [value];
}
