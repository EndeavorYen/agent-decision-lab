const contracts = {
  init: ['description', 'owner'],
  status: [],
  migrate: ['dryRun'],
  repair: ['dryRun'],
  whereami: ['json'],
  context: ['json'],
  doctor: ['json'],
  ui: ['host', 'port'],
  'lab start': ['description', 'owner', 'decision', 'savepoint', 'rationale', 'variants', 'contextPolicies', 'contextPolicy', 'worktree', 'promptSummary', 'hypothesis'],
  'privacy audit': ['path', 'publicFiles', 'blocklist', 'json'],
  'insight export': ['variants', 'out', 'includePrivate', 'redact'],
  'mcp serve': [],
  'adapter list': [],
  'plugin list': [],
  'adapter show': ['adapter', 'variant'],
  'plugin show': ['adapter', 'variant'],
  'adapter scaffold': ['adapter', 'variant', 'out'],
  'plugin scaffold': ['adapter', 'variant', 'out'],
  'experiment create': ['description', 'owner'],
  'experiment list': [],
  'experiment switch': ['experiment'],
  'case-study init': ['description', 'owner', 'decision', 'rationale', 'savepoint'],
  'case-study add-variant': ['from', 'branch', 'worktreePath', 'worktree', 'attach', 'promptSummary', 'contextPolicy', 'promptPolicy', 'hypothesis', 'risk', 'risks', 'visibleContext', 'visible', 'withheldContext', 'withheld', 'controls'],
  'case-study record-result': ['variant', 'artifact', 'artifacts', 'artifactId', 'classification', 'visibleToAgent', 'summary', 'rubric', 'reviewer', 'scores', 'score', 'noScore', 'strengths', 'weaknesses', 'evidence'],
  'case-study export': ['outDir', 'rubric'],
  'rebuild init': ['base', 'baseWorktree', 'branch', 'keep', 'decision', 'savepoint', 'rationale', 'variants', 'worktree'],
  'decision create': ['rationale', 'parent', 'parentId'],
  'savepoint create': ['decision', 'rationale', 'contextPolicy'],
  'savepoint checkout': ['savepoint', 'branch', 'force'],
  'variant start': ['decision', 'from', 'branch', 'worktreePath', 'worktree', 'attach', 'promptSummary'],
  'variant checkout': ['variant', 'force'],
  'worktree list': [],
  'worktree status': [],
  'worktree cleanup': ['dryRun'],
  'strategy set': ['from', 'contextPolicy', 'promptPolicy', 'hypothesis', 'risk', 'risks', 'visibleContext', 'visible', 'withheldContext', 'withheld', 'controls'],
  'artifact add': ['id', 'variant', 'path', 'classification', 'visibleToAgent', 'summary'],
  'template context-ab': ['question', 'decision', 'a', 'b', 'c'],
  evaluate: ['variant', 'rubric', 'reviewer', 'scores', 'score', 'noScore', 'strengths', 'weaknesses', 'evidence'],
  compare: ['rubric', 'out'],
  'guidance draft': ['comparison', 'out'],
  orchestrate: ['variant', 'response', 'actor', 'note', 'checkpoint'],
  'log prompt': ['stdin', 'file', 'variant', 'actor', 'metadata'],
  'log response': ['stdin', 'file', 'variant', 'actor', 'metadata'],
  'log note': ['stdin', 'file', 'variant', 'actor', 'metadata'],
  'log command': ['stdin', 'file', 'variant', 'actor', 'metadata'],
  'log artifact': ['stdin', 'file', 'variant', 'actor', 'metadata'],
  checkpoint: ['stdin', 'file', 'variant', 'actor'],
  tree: [],
  export: ['format', 'includePrivate', 'redact', 'out'],
  run: ['variant', 'actor', 'quiet', 'tail'],
};

export const commandContracts = Object.freeze(
  Object.fromEntries(Object.entries(contracts).map(([name, options]) => [
    name,
    Object.freeze({ options: Object.freeze(['help', ...options]) }),
  ])),
);

export function validateCommandInvocation(name, options) {
  const contract = commandContracts[name];
  if (!contract) {
    return;
  }
  for (const option of Object.keys(options)) {
    if (contract.options.includes(option)) {
      continue;
    }
    const suggestion = closestOption(option, contract.options);
    throw new Error([
      `Unknown option --${toKebab(option)} for ${name}`,
      suggestion ? `Did you mean --${toKebab(suggestion)}?` : null,
    ].filter(Boolean).join('. '));
  }
}

export function closestOption(value, allowed) {
  if (allowed.length === 0) {
    return null;
  }
  const ranked = allowed
    .map((candidate) => ({ candidate, distance: editDistance(value, candidate) }))
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate));
  return ranked[0].distance <= Math.max(2, Math.floor(value.length / 3))
    ? ranked[0].candidate
    : null;
}

function editDistance(left, right) {
  const rows = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let index = 0; index <= left.length; index += 1) rows[index][0] = index;
  for (let index = 0; index <= right.length; index += 1) rows[0][index] = index;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
  }
  return rows[left.length][right.length];
}

function toKebab(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
