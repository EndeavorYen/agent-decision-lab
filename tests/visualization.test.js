import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, createTempGitRepo } from './helpers.js';
import { compareVariants } from '../src/compare.js';
import { exportExperiment } from '../src/export.js';
import { draftGuidance } from '../src/guidance.js';
import { createExperimentStore } from '../src/store.js';
import { addArtifact, evaluateVariant } from '../src/strategy.js';
import { createContextAbTemplate } from '../src/templates.js';

test('does not render a guidance node until a guidance draft exists', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Project Guidance Strategy Lab' });
    const { variants } = await createContextAbTemplate(repo, {
      question: 'Should the agent read project guidance before writing code review rules?',
      decision: 'Context visibility',
      a: 'guidance-visible',
      b: 'prompt-only',
    });
    await compareVariants(repo, {
      variants: variants.map((variant) => variant.id),
      rubric: 'code-review-rule-quality',
    });

    const mermaid = await exportExperiment(repo, {
      format: 'mermaid',
      includePrivate: false,
      redact: true,
    });

    assert.doesNotMatch(mermaid, /Guidance draft/);
  } finally {
    await cleanup(repo);
  }
});

test('exports a Mermaid tree with decision, savepoint, variants, artifacts, evaluation, comparison, and guidance nodes', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Project Guidance Strategy Lab' });
    const { variants } = await createContextAbTemplate(repo, {
      question: 'Should the agent read project guidance before writing code review rules?',
      decision: 'Context visibility',
      a: 'guidance-visible',
      b: 'prompt-only',
      c: 'draft-then-compare',
    });
    await addArtifact(repo, {
      id: 'guidance-visible-rules',
      variant: variants[0].id,
      path: 'outputs/guidance-visible-rules.md',
      classification: 'private',
      summary: 'Generated rules',
    });
    await evaluateVariant(repo, {
      variant: variants[0].id,
      rubric: 'code-review-rule-quality',
      scores: { alignment: 5 },
      evidence: ['guidance-visible-rules'],
    });
    const comparison = await compareVariants(repo, {
      variants: variants.map((variant) => variant.id),
      rubric: 'code-review-rule-quality',
    });
    await draftGuidance(repo, { comparison: comparison.id });

    const mermaid = await exportExperiment(repo, {
      format: 'mermaid',
      includePrivate: false,
      redact: true,
    });

    assert.match(mermaid, /^flowchart TD/);
    assert.match(mermaid, /Decision: Context visibility/);
    assert.match(mermaid, /Savepoint: Read project guidance\?/);
    assert.match(mermaid, /Variant: guidance-visible/);
    assert.match(mermaid, /Variant: prompt-only/);
    assert.match(mermaid, /Artifact: guidance-visible-rules/);
    assert.match(mermaid, /Evaluation: code-review-rule-quality/);
    assert.match(mermaid, /Comparison report/);
    assert.match(mermaid, /Guidance draft/);
  } finally {
    await cleanup(repo);
  }
});
