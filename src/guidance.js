import { join } from 'node:path';
import { loadCurrentStore, writeJson } from './store.js';
import { readComparison } from './strategy.js';

export async function draftGuidance(repoPath, input) {
  const store = await loadCurrentStore(repoPath);
  const comparison = input.comparison
    ? await readComparison(store, input.comparison)
    : store.comparisons.at(-1);
  if (!comparison) {
    throw new Error('No comparison found; run adl compare first or pass --comparison');
  }
  const guidance = renderGuidance(comparison);
  await writeJson(join(store.paths.exportsDir, 'guidance.json'), {
    id: `guidance_${comparison.id}`,
    comparisonId: comparison.id,
    markdown: guidance,
    createdAt: new Date().toISOString(),
  });
  return guidance;
}

function renderGuidance(comparison) {
  const ranked = rankedVariants(comparison);
  const topVariants = leadingVariants(ranked);
  const hasQualitativeEvaluations = comparison.variants.some((variant) => variant.evaluation);
  const supported = supportedLines(topVariants, hasQualitativeEvaluations);
  const suggested = suggestedLines(comparison.variants, topVariants, hasQualitativeEvaluations);

  return [
    '# Agent Collaboration Guidance',
    '',
    '## Supported By This Experiment',
    '',
    ...supported,
    '',
    '## Suggested But Not Proven',
    '',
    ...suggested,
    '',
    '## Evidence',
    '',
    `- Comparison: ${comparison.id}`,
    `- Judgment: ${comparison.judgment}`,
    `- Warnings: ${comparison.warnings.length}`,
    ...scoreLines(ranked),
    '',
    '## Open Questions',
    '',
    ...openQuestions(topVariants, hasQualitativeEvaluations),
    '',
  ].join('\n');
}

function rankedVariants(comparison) {
  return comparison.variants
    .filter((variant) => Number.isFinite(variant.totalScore))
    .toSorted((a, b) => b.totalScore - a.totalScore);
}

function leadingVariants(ranked) {
  if (ranked.length === 0) {
    return [];
  }
  const highScore = ranked[0].totalScore;
  return ranked.filter((variant) => variant.totalScore === highScore);
}

function supportedLines(topVariants, hasQualitativeEvaluations) {
  if (topVariants.length === 0) {
    return hasQualitativeEvaluations
      ? ['- No winner selected. Use the qualitative evidence table for human or LLM review before choosing a guidance rule.']
      : ['- No strategy is supported yet. Add evaluations before turning the comparison into guidance.'];
  }
  if (topVariants.length > 1) {
    return [`- No single strategy is supported by score alone. Tied variants: ${topVariants.map((variant) => variant.name).join(', ')}.`];
  }
  return [recommendationLine(topVariants[0], 'Use')];
}

function suggestedLines(variants, topVariants, hasQualitativeEvaluations) {
  if (topVariants.length === 0 && hasQualitativeEvaluations) {
    return ['- Recommended next experiment: rerun the most promising qualitative variants on a different task, or ask a reviewer/LLM to judge the recorded artifacts.'];
  }
  const topIds = new Set(topVariants.map((variant) => variant.id));
  const alternatives = variants.filter((variant) => !topIds.has(variant.id));
  if (alternatives.length === 0) {
    return ['- Repeat the experiment with a different task, agent, or rubric before treating this as a stable playbook rule.'];
  }
  return alternatives.map((variant) => recommendationLine(variant, 'Also test'));
}

function recommendationLine(variant, verb) {
  const policy = variant.strategy?.contextPolicy ?? 'unspecified';
  const hypothesis = variant.strategy?.hypothesis ? ` Hypothesis: ${variant.strategy.hypothesis}.` : '';
  switch (policy) {
    case 'guidance-visible':
      return `- ${verb} ${variant.name} when alignment with quality philosophy, risk appetite, or process expectations is the main success criterion.${hypothesis}`;
    case 'prompt-only':
      return `- ${verb} ${variant.name} when focus, concrete formatting, or reusable rule wording is the main success criterion.${hypothesis}`;
    case 'delayed-guidance':
      return `- ${verb} ${variant.name} when you want an initial focused draft but still need a planning-document check before acceptance.${hypothesis}`;
    default:
      return `- ${verb} ${variant.name} when its recorded strategy fits the task constraints.${hypothesis}`;
  }
}

function scoreLines(ranked) {
  if (ranked.length === 0) {
    return ['- Scores: none recorded'];
  }
  return [`- Score ranking: ${ranked.map((variant) => `${variant.name} ${variant.totalScore}`).join(', ')}`];
}

function openQuestions(topVariants, hasQualitativeEvaluations) {
  if (topVariants.length === 0 && hasQualitativeEvaluations) {
    return [
      '- Which qualitative findings should become score criteria or release gates?',
      '- Which artifacts would make the human or LLM review less subjective?',
    ];
  }
  if (topVariants.length === 0) {
    return [
      '- Which rubric criteria should be recorded before a guidance draft is trusted?',
      '- Which artifacts are needed to make the comparison auditable?',
    ];
  }
  const leaders = topVariants.map((variant) => variant.name).join(', ');
  return [
    `- Does ${leaders} still lead on a different task, agent, or rubric?`,
    '- Which weaker criteria should become gates instead of additive score inputs?',
  ];
}
