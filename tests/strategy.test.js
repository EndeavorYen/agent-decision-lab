import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, createTempGitRepo } from './helpers.js';
import { createDecision, createExperimentStore, createSavepoint, startVariant } from '../src/store.js';
import { addArtifact, evaluateVariant, setStrategy } from '../src/strategy.js';

async function createVariant(repo) {
  await createExperimentStore(repo, { title: 'Project Guidance Strategy Lab' });
  const decision = await createDecision(repo, {
    title: 'Context visibility',
    rationale: 'Compare context strategies',
  });
  const savepoint = await createSavepoint(repo, {
    title: 'Read project guidance?',
    decision: decision.id,
  });
  const variant = await startVariant(repo, {
    name: 'guidance-visible',
    from: savepoint.id,
    createBranch: true,
  });
  return { savepoint, variant };
}

test('records strategy metadata with visible and withheld context', async () => {
  const repo = await createTempGitRepo();
  try {
    const { savepoint, variant } = await createVariant(repo);

    const strategy = await setStrategy(repo, {
      variant: variant.id,
      from: savepoint.id,
      contextPolicy: 'guidance-visible',
      promptPolicy: 'task-plus-guidance',
      hypothesis: 'project guidance context improves alignment',
      risks: ['May overfit planning text'],
      visibleContext: ['context-doc'],
      withheldContext: [],
      controls: ['same base commit', 'same task prompt'],
    });

    assert.equal(strategy.variantId, variant.id);
    assert.equal(strategy.savepointId, savepoint.id);
    assert.equal(strategy.contextPolicy, 'guidance-visible');
    assert.deepEqual(strategy.visibleContext, ['context-doc']);
  } finally {
    await cleanup(repo);
  }
});

test('records private artifacts and manual rubric evaluations', async () => {
  const repo = await createTempGitRepo();
  try {
    const { variant } = await createVariant(repo);
    const artifact = await addArtifact(repo, {
      id: 'guidance-output',
      variant: variant.id,
      path: 'outputs/guidance-visible-rules.md',
      classification: 'private',
      visibleToAgent: true,
      summary: 'Generated code review rules',
    });

    const evaluation = await evaluateVariant(repo, {
      variant: variant.id,
      rubric: 'code-review-rule-quality',
      reviewer: 'human',
      scores: {
        alignment: 5,
        specificity: 4,
        signalToNoise: 4,
        riskCoverage: 5,
        maintainability: 4,
        overfitRisk: 2,
        evidenceQuality: 4,
      },
      strengths: ['Rules reflect quality philosophy'],
      weaknesses: ['Some wording is broad'],
      evidence: [artifact.id],
    });

    assert.equal(artifact.variantId, variant.id);
    assert.equal(evaluation.variantId, variant.id);
    assert.equal(evaluation.rubricId, 'code-review-rule-quality');
    assert.equal(evaluation.scores.alignment, 5);
  } finally {
    await cleanup(repo);
  }
});

test('rejects rubric scores outside the 1 to 5 range', async () => {
  const repo = await createTempGitRepo();
  try {
    const { variant } = await createVariant(repo);
    await assert.rejects(
      () => evaluateVariant(repo, {
        variant: variant.id,
        rubric: 'code-review-rule-quality',
        scores: { alignment: 6 },
      }),
      /Rubric score alignment must be between 1 and 5/,
    );
  } finally {
    await cleanup(repo);
  }
});
