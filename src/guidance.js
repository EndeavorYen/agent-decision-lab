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
  return [
    '# Agent Collaboration Guidance',
    '',
    '## Supported By This Experiment',
    '',
    '- Show planning documents when alignment with quality philosophy, risk appetite, or process expectations is the main success criterion.',
    '',
    '## Suggested But Not Proven',
    '',
    '- Start prompt-only when the task needs narrow focus, then compare the draft against project guidance afterward.',
    '- Summarize long planning documents into explicit constraints when noise risk is high.',
    '',
    '## Evidence',
    '',
    `- Comparison: ${comparison.id}`,
    `- Judgment: ${comparison.judgment}`,
    `- Warnings: ${comparison.warnings.length}`,
    '',
    '## Open Questions',
    '',
    '- Does the guidance-visible strategy still win when the output format is highly constrained?',
    '- Does delayed project guidance review reduce overfitting while preserving alignment?',
    '',
  ].join('\n');
}
