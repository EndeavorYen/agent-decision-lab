import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, createTempGitRepo } from './helpers.js';
import { compareVariants } from '../src/compare.js';
import { exportExperiment } from '../src/export.js';
import { draftGuidance } from '../src/guidance.js';
import { createDecision, createExperimentStore, createSavepoint, startVariant } from '../src/store.js';
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

test('exports nested decisions under their parent variant', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Deep Strategy Tree' });
    const rootDecision = await createDecision(repo, {
      title: 'Context visibility',
      rationale: 'Pick the first context strategy',
    });
    const rootSavepoint = await createSavepoint(repo, {
      title: 'Read project guidance?',
      decision: rootDecision.id,
    });
    const rootVariant = await startVariant(repo, {
      name: 'prompt-only',
      from: rootSavepoint.id,
      createBranch: true,
    });
    const nestedDecision = await createDecision(repo, {
      title: 'Evidence check timing',
      parentId: rootVariant.id,
      rationale: 'Decide when to compare the prompt-only draft with evidence',
    });
    const nestedSavepoint = await createSavepoint(repo, {
      title: 'Before evidence check',
      decision: nestedDecision.id,
    });
    await startVariant(repo, {
      name: 'same-turn-check',
      from: nestedSavepoint.id,
      createBranch: true,
    });

    const mermaid = await exportExperiment(repo, { format: 'mermaid' });

    assert.match(mermaid, /var_prompt_only --> dec_evidence_check_timing/);
    assert.match(mermaid, /dec_evidence_check_timing --> sp_before_evidence_check/);
    assert.match(mermaid, /sp_before_evidence_check --> var_same_turn_check/);
  } finally {
    await cleanup(repo);
  }
});

test('exports a standalone SVG tree for visual inspection', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'SVG Strategy Tree' });
    const decision = await createDecision(repo, {
      title: 'Context visibility',
      rationale: 'Pick the first context strategy',
    });
    const savepoint = await createSavepoint(repo, {
      title: 'Read project guidance?',
      decision: decision.id,
    });
    const variant = await startVariant(repo, {
      name: 'prompt-only',
      from: savepoint.id,
      createBranch: true,
    });
    await addArtifact(repo, {
      id: 'prompt-only-output',
      variant: variant.id,
      path: 'outputs/prompt-only.md',
    });
    await evaluateVariant(repo, {
      variant: variant.id,
      scores: { alignment: 4, specificity: 5 },
    });

    const svg = await exportExperiment(repo, { format: 'svg' });

    assert.match(svg, /^<svg /);
    assert.match(svg, /SVG Strategy Tree/);
    assert.match(svg, /Decision: Context visibility/);
    assert.match(svg, /Savepoint: Read project guidance\?/);
    assert.match(svg, /Variant: prompt-only/);
    assert.match(svg, /score 9/);
  } finally {
    await cleanup(repo);
  }
});

test('exports a standalone HTML report with embedded visual tree', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'HTML Strategy Report' });
    const decision = await createDecision(repo, {
      title: 'Context visibility',
      rationale: 'Pick the first context strategy',
    });
    const savepoint = await createSavepoint(repo, {
      title: 'Read project guidance?',
      decision: decision.id,
    });
    await startVariant(repo, {
      name: 'prompt-only',
      from: savepoint.id,
      createBranch: true,
    });

    const html = await exportExperiment(repo, { format: 'html' });

    assert.match(html, /^<!doctype html>/);
    assert.match(html, /HTML Strategy Report/);
    assert.match(html, /<svg /);
    assert.match(html, /Variant: prompt-only/);
    assert.match(html, /Decision Tree/);
  } finally {
    await cleanup(repo);
  }
});

test('exports an HTML dashboard with artifacts tests qualitative findings privacy and freshness', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Dashboard Strategy Report' });
    const { variants } = await createContextAbTemplate(repo, {
      question: 'Which strategy should be used?',
      decision: 'Strategy choice',
      a: 'docs-visible',
      b: 'prompt-only',
    });
    await addArtifact(repo, {
      id: 'docs-visible-patch',
      variant: variants[0].id,
      path: 'outputs/docs-visible.patch',
      summary: 'Patch from docs-visible',
    });
    await evaluateVariant(repo, {
      variant: variants[0].id,
      noScore: true,
      strengths: ['Best isolated proof'],
      weaknesses: ['More setup'],
      evidence: ['npm test passed'],
    });
    await compareVariants(repo, {
      variants: variants.map((variant) => variant.id),
      rubric: 'code-review-rule-quality',
    });

    const html = await exportExperiment(repo, { format: 'html' });

    assert.match(html, /Artifacts/);
    assert.match(html, /docs-visible-patch/);
    assert.match(html, /Command Runs/);
    assert.match(html, /Qualitative Findings/);
    assert.match(html, /Best isolated proof/);
    assert.match(html, /Privacy/);
    assert.match(html, /Redaction/);
    assert.match(html, /Export Freshness/);
    assert.match(html, /not scored/);
  } finally {
    await cleanup(repo);
  }
});

test('redacts sensitive text from SVG and HTML visual exports by default', async () => {
  const repo = await createTempGitRepo();
  try {
    await createExperimentStore(repo, { title: 'Secret Bearer fake-token-for-redaction-test' });
    const decision = await createDecision(repo, {
      title: 'Context visibility',
      rationale: 'Pick the first context strategy',
    });
    const savepoint = await createSavepoint(repo, {
      title: 'Read project guidance?',
      decision: decision.id,
    });
    await startVariant(repo, {
      name: 'prompt-only',
      from: savepoint.id,
      createBranch: true,
    });

    const svg = await exportExperiment(repo, { format: 'svg' });
    const html = await exportExperiment(repo, { format: 'html' });

    assert.doesNotMatch(svg, /fake-token-for-redaction-test/);
    assert.doesNotMatch(html, /fake-token-for-redaction-test/);
    assert.match(svg, /\[REDACTED/);
    assert.match(html, /\[REDACTED/);
  } finally {
    await cleanup(repo);
  }
});
