import { join } from 'node:path';
import { slugify } from './ids.js';
import { findVariant, loadCurrentStore, writeJson } from './store.js';
import { normalizeRecordId } from './strategy.js';

export async function compareVariants(repoPath, input) {
  const store = await loadCurrentStore(repoPath);
  const variants = input.variants.map((value) => {
    const variant = findVariant(store, value);
    if (!variant) {
      throw new Error(`Variant not found: ${value}`);
    }
    return variant;
  });
  const savepointId = variants[0]?.savepointId ?? null;
  const rubricId = normalizeRecordId(input.rubric ?? 'code-review-rule-quality');
  const rows = variants.map((variant) => comparisonRow(store, variant, rubricId));
  const warnings = [];
  for (const row of rows) {
    if (!row.evaluation) {
      warnings.push(`${row.variant.name} is missing evaluation for ${rubricId}`);
    }
    if (row.artifacts.length === 0) {
      warnings.push(`${row.variant.name} has no output artifact`);
    }
  }
  if (new Set(variants.map((variant) => variant.savepointId)).size > 1) {
    warnings.push('Variants do not share the same savepoint');
  }

  const id = `cmp_${variants.map((variant) => slugify(variant.name)).join('_vs_')}`;
  const comparison = {
    id,
    rubricId,
    savepointId,
    variants: rows.map((row) => ({
      id: row.variant.id,
      name: row.variant.name,
      strategy: row.strategy,
      artifacts: row.artifacts,
      evaluation: row.evaluation,
      totalScore: totalScore(row.evaluation),
    })),
    warnings,
    judgment: judgment(rows),
    createdAt: new Date().toISOString(),
  };
  comparison.markdown = renderComparisonMarkdown(store, comparison);

  await writeJson(join(store.paths.comparisonsDir, `${comparison.id}.json`), comparison);
  return comparison;
}

export function renderComparisonMarkdown(store, comparison) {
  const savepoint = store.savepoints.find((record) => record.id === comparison.savepointId);
  const lines = [
    `# Comparison: ${comparison.variants.map((variant) => variant.name).join(' vs ')}`,
    '',
    '## Executive Summary',
    '',
    `- Judgment: ${comparison.judgment}`,
    `- Rubric: ${comparison.rubricId}`,
    `- Warnings: ${comparison.warnings.length}`,
    '',
    '## Savepoint and Fork Summary',
    '',
    `- Savepoint: ${savepoint ? `${savepoint.title} (${savepoint.id})` : comparison.savepointId ?? 'unknown'}`,
    `- Fork commit: ${savepoint?.git?.commit ?? 'unknown'}`,
    '',
    '## Variant Strategy Table',
    '',
    '| Variant | Context Policy | Hypothesis | Total Score |',
    '| --- | --- | --- | --- |',
  ];

  for (const variant of comparison.variants) {
    lines.push(`| ${variant.name} | ${variant.strategy?.contextPolicy ?? 'missing strategy'} | ${variant.strategy?.hypothesis ?? ''} | ${variant.totalScore ?? 'missing evaluation'} |`);
  }

  lines.push('', '## Artifact Table', '', '| Variant | Artifacts |', '| --- | --- |');
  for (const variant of comparison.variants) {
    lines.push(`| ${variant.name} | ${variant.artifacts.map((artifact) => artifact.id).join(', ') || 'missing artifact'} |`);
  }

  lines.push('', '## Rubric Score Table', '', '| Variant | Scores |', '| --- | --- |');
  for (const variant of comparison.variants) {
    const scores = variant.evaluation
      ? Object.entries(variant.evaluation.scores).map(([key, value]) => `${key}: ${value}`).join(', ')
      : 'missing evaluation';
    lines.push(`| ${variant.name} | ${scores} |`);
  }

  lines.push('', '## Qualitative Comparison', '');
  for (const variant of comparison.variants) {
    lines.push(`- ${variant.name}: strengths ${listText(variant.evaluation?.strengths)}; weaknesses ${listText(variant.evaluation?.weaknesses)}.`);
  }

  lines.push('', '## Threats to Validity', '');
  if (comparison.warnings.length === 0) {
    lines.push('- No structural warnings recorded.');
  } else {
    for (const warning of comparison.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('', '## Guidance Candidates', '');
  lines.push('- Treat recommendations as evidence-backed, not universal truth.');
  lines.push('- Prefer showing planning documents when alignment and risk appetite matter.');
  lines.push('- Prefer prompt-only starts when focus and concrete formatting matter most.');
  lines.push('');

  return lines.join('\n');
}

function comparisonRow(store, variant, rubricId) {
  return {
    variant,
    strategy: store.strategies.find((strategy) => strategy.variantId === variant.id) ?? null,
    artifacts: store.artifacts.artifacts.filter((artifact) => artifact.variantId === variant.id),
    evaluation: store.evaluations.find((evaluation) => (
      evaluation.variantId === variant.id && evaluation.rubricId === rubricId
    )) ?? null,
  };
}

function totalScore(evaluation) {
  if (!evaluation) {
    return null;
  }
  return Object.values(evaluation.scores).reduce((sum, score) => sum + score, 0);
}

function judgment(rows) {
  const scored = rows
    .map((row) => ({ name: row.variant.name, score: totalScore(row.evaluation) }))
    .filter((row) => row.score !== null)
    .sort((a, b) => b.score - a.score);
  if (scored.length < 2 || scored[0].score === scored[1].score) {
    return 'inconclusive';
  }
  return `${scored[0].name} currently leads on recorded rubric scores`;
}

function listText(values) {
  if (!values || values.length === 0) {
    return 'none recorded';
  }
  return values.join('; ');
}
