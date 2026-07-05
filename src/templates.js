import { createDecision, createSavepoint, startVariant } from './store.js';
import { setStrategy } from './strategy.js';

export async function createContextAbTemplate(repoPath, input) {
  const decision = await createDecision(repoPath, {
    title: input.decision,
    rationale: input.question,
  });
  const savepoint = await createSavepoint(repoPath, {
    title: 'Read project guidance?',
    decision: decision.id,
    rationale: 'Fork all project guidance visibility strategies from the same clean state',
  });

  const names = [input.a, input.b, input.c].filter(Boolean);
  const variants = [];
  const strategies = [];
  for (const name of names) {
    const variant = await startVariant(repoPath, {
      name,
      from: savepoint.id,
      createBranch: true,
    });
    variants.push(variant);
    strategies.push(await setStrategy(repoPath, defaultStrategyInput(name, variant.id, savepoint.id)));
  }

  return { decision, savepoint, variants, strategies };
}

function defaultStrategyInput(name, variantId, savepointId) {
  if (name.includes('prompt')) {
    return {
      variant: variantId,
      from: savepointId,
      contextPolicy: 'prompt-only',
      promptPolicy: 'task-only',
      hypothesis: 'Focused prompt improves rule specificity',
      risks: ['May miss quality philosophy and produce generic rules'],
      withheldContext: ['context-doc'],
      controls: ['same savepoint commit', 'same task prompt'],
    };
  }
  if (name.includes('compare') || name.includes('delayed')) {
    return {
      variant: variantId,
      from: savepointId,
      contextPolicy: 'delayed-guidance',
      promptPolicy: 'draft-first-then-compare',
      hypothesis: 'Drafting first then checking project guidance may balance focus and alignment',
      risks: ['May require extra review effort'],
      withheldContext: ['context-doc-until-after-draft'],
      controls: ['same savepoint commit', 'same task prompt'],
    };
  }
  return {
    variant: variantId,
    from: savepointId,
    contextPolicy: 'guidance-visible',
    promptPolicy: 'task-plus-guidance',
    hypothesis: 'project guidance context improves alignment with quality philosophy',
    risks: ['May overfit planning text or become too broad'],
    visibleContext: ['context-doc'],
    controls: ['same savepoint commit', 'same task prompt'],
  };
}
