import { findVariant } from './store.js';

export function renderOrchestratorGuide(store, input = {}) {
  const variant = selectVariant(store, input.variant);
  const strategy = variant
    ? store.strategies.find((record) => record.variantId === variant.id)
    : null;
  const lines = [
    `Current lab: ${store.experiment.title}`,
    `Base lab: ${store.repoPath}`,
    `Current phase: ${phaseFor(store)}`,
    '',
  ];

  if (!variant) {
    lines.push(
      'No route selected.',
      'Next action: create a variant with `adl case-study add-variant`.',
      '',
    );
    return lines.join('\n');
  }

  lines.push(
    `Next route: ${variant.name}`,
    `Metadata operations: run ADL commands from ${store.repoPath}`,
    `Code worktree: ${variant.worktreePath ?? store.repoPath}`,
    `Branch: ${variant.branch}`,
    '',
    'Prompt block:',
    '```text',
    `You are working on ADL variant "${variant.name}".`,
    `Context policy: ${strategy?.contextPolicy ?? 'unspecified'}.`,
  );

  if (strategy?.visibleContext?.length) {
    lines.push(`Visible context: ${strategy.visibleContext.join(', ')}.`);
  }
  if (strategy?.withheldContext?.length) {
    lines.push(`Withheld context: ${strategy.withheldContext.join(', ')}.`);
  }
  if (strategy?.hypothesis) {
    lines.push(`Hypothesis: ${strategy.hypothesis}.`);
  }
  if (strategy?.controls?.length) {
    lines.push(`Controls: ${strategy.controls.join(', ')}.`);
  }

  lines.push(
    'Do the route work in the code worktree. Return a concise summary, changed files, verification commands, and risks.',
    '```',
    '',
    'Next actions:',
    `- Open the code worktree for ${variant.name}.`,
    '- Paste the prompt block into the agent session.',
    '- Record the response with `adl orchestrate --variant <name> --response "..."`.',
    '- Record checkpoints or verification evidence before moving to the next route.',
    '',
  );

  return lines.join('\n');
}

function selectVariant(store, value) {
  if (value) {
    return findVariant(store, value);
  }
  return store.variants.find((variant) => variant.status !== 'closed') ?? store.variants[0] ?? null;
}

function phaseFor(store) {
  if (store.variants.length === 0) {
    return 'case-study initialized';
  }
  if (store.evaluations.length < store.variants.length) {
    return 'collecting variant evidence';
  }
  if (store.comparisons.length === 0) {
    return 'ready to compare';
  }
  return 'ready to export or iterate';
}
