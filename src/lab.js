import { dirtyPathsOutsideLab } from './git.js';
import {
  createDecision,
  createExperimentStore,
  createNewExperimentStore,
  createSavepoint,
  loadCurrentStore,
  saveConfig,
  startVariant,
} from './store.js';
import { setStrategy } from './strategy.js';

export async function startGuidedLab(repoPath, input = {}) {
  const dirty = dirtyPathsOutsideLab(repoPath);
  if (dirty.length > 0) {
    throw new Error(`Refusing to start lab with dirty non-lab files: ${dirty.join(', ')}`);
  }
  if (!input.title) {
    throw new Error('Lab title is required');
  }

  const create = input.labExists ? createNewExperimentStore : createExperimentStore;
  const experiment = await create(repoPath, {
    title: input.title,
    description: input.description ?? '',
    owner: input.owner ?? null,
  });
  const decision = await createDecision(repoPath, {
    title: input.decision ?? 'Agent collaboration strategy',
    rationale: input.rationale ?? 'Guided first-run strategy lab',
  });
  const savepoint = await createSavepoint(repoPath, {
    title: input.savepoint ?? 'Before strategy fork',
    decision: decision.id,
  });

  const variantNames = listOption(input.variants);
  const policies = listOption(input.contextPolicies);
  const variants = [];
  for (let index = 0; index < variantNames.length; index += 1) {
    const name = variantNames[index];
    const variant = await startVariant(repoPath, {
      name,
      from: savepoint.id,
      createBranch: true,
      createWorktree: input.worktree === true,
      promptSummary: input.promptSummary ?? '',
    });
    variants.push(variant);
    await setStrategy(repoPath, {
      variant: variant.id,
      from: savepoint.id,
      contextPolicy: policies[index] ?? name,
      hypothesis: input.hypothesis ?? '',
    });
  }

  const store = await loadCurrentStore(repoPath);
  store.config.activeVariantId = null;
  await saveConfig(store);

  return {
    experiment,
    decision,
    savepoint,
    variants,
    next: [
      'adl status',
      `adl orchestrate ${variants[0]?.name ?? '<variant>'}`,
      'adl run --variant <variant> -- npm test',
      `adl insight export --variants ${variants.map((variant) => variant.name).join(',')} --out .agent-lab/exports/insight-pack.json`,
    ],
  };
}

export function formatGuidedLabResult(result) {
  return [
    `Created strategy lab ${result.experiment.id}`,
    `Decision: ${result.decision.id}`,
    `Savepoint: ${result.savepoint.id}`,
    'Variants:',
    ...result.variants.map((variant) => `- ${variant.name}: ${variant.worktreePath ?? variant.branch}`),
    '',
    'Next:',
    ...result.next.map((step) => `  ${step}`),
    '',
  ].join('\n');
}

function listOption(value) {
  const items = Array.isArray(value)
    ? value.flatMap(listOption)
    : String(value ?? 'docs-visible,prompt-only').split(',');
  return items
    .map((item) => String(item).trim())
    .filter(Boolean);
}
