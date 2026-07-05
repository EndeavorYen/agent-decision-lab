import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, createTempGitRepo } from './helpers.js';
import { createExperimentStore } from '../src/store.js';
import { compareVariants } from '../src/compare.js';
import { draftGuidance } from '../src/guidance.js';
import { addArtifact, evaluateVariant } from '../src/strategy.js';
import { createContextAbTemplate } from '../src/templates.js';

async function createEvaluatedExperiment() {
  const repo = await createTempGitRepo();
  await createExperimentStore(repo, { title: 'Project Guidance Strategy Lab' });
  const { variants } = await createContextAbTemplate(repo, {
    question: 'Should the agent read project guidance before writing code review rules?',
    decision: 'Context visibility',
    a: 'guidance-visible',
    b: 'prompt-only',
    c: 'draft-then-compare',
  });

  for (const variant of variants) {
    await addArtifact(repo, {
      id: `${variant.name}-rules`,
      variant: variant.id,
      path: `outputs/${variant.name}-rules.md`,
      classification: 'private',
      summary: `Rules from ${variant.name}`,
    });
  }

  await evaluateVariant(repo, {
    variant: variants[0].id,
    rubric: 'code-review-rule-quality',
    scores: { alignment: 5, specificity: 4, signalToNoise: 3, riskCoverage: 5 },
    strengths: ['Best alignment with project guidance'],
    weaknesses: ['Some broad language'],
    evidence: [`${variants[0].name}-rules`],
  });
  await evaluateVariant(repo, {
    variant: variants[1].id,
    rubric: 'code-review-rule-quality',
    scores: { alignment: 3, specificity: 5, signalToNoise: 5, riskCoverage: 3 },
    strengths: ['Most focused'],
    weaknesses: ['Less project-specific'],
    evidence: [`${variants[1].name}-rules`],
  });

  return { repo, variants };
}

test('compares variants with strategy, savepoint, artifacts, scores, and warnings', async () => {
  const { repo, variants } = await createEvaluatedExperiment();
  try {
    const comparison = await compareVariants(repo, {
      variants: variants.map((variant) => variant.id),
      rubric: 'code-review-rule-quality',
    });

    assert.equal(comparison.variants.length, 3);
    assert.equal(comparison.savepointId, variants[0].savepointId);
    assert.match(comparison.markdown, /## Savepoint and Fork Summary/);
    assert.match(comparison.markdown, /guidance-visible/);
    assert.match(comparison.markdown, /prompt-only/);
    assert.match(comparison.markdown, /draft-then-compare/);
    assert.match(comparison.markdown, /missing evaluation/i);
  } finally {
    await cleanup(repo);
  }
});

test('drafts conservative guidance from comparison evidence', async () => {
  const { repo, variants } = await createEvaluatedExperiment();
  try {
    const comparison = await compareVariants(repo, {
      variants: variants.map((variant) => variant.id),
      rubric: 'code-review-rule-quality',
    });
    const guidance = await draftGuidance(repo, { comparison: comparison.id });

    assert.match(guidance, /# Agent Collaboration Guidance/);
    assert.match(guidance, /supported by this experiment/i);
    assert.match(guidance, /suggested but not proven/i);
    assert.match(guidance, /project guidance/);
  } finally {
    await cleanup(repo);
  }
});

test('drafts guidance from the latest comparison when no comparison id is provided', async () => {
  const { repo, variants } = await createEvaluatedExperiment();
  try {
    await compareVariants(repo, {
      variants: variants.map((variant) => variant.id),
      rubric: 'code-review-rule-quality',
    });
    const guidance = await draftGuidance(repo, {});

    assert.match(guidance, /# Agent Collaboration Guidance/);
    assert.match(guidance, /Comparison:/);
  } finally {
    await cleanup(repo);
  }
});
