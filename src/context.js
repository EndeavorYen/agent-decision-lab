import { access } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { dirtyPathsOutsideLab, git, getCurrentBranch, getCurrentCommit } from './git.js';
import { redactText } from './redact.js';
import { findVariant, loadCurrentStore } from './store.js';
import { runDoctor } from './doctor.js';

export async function inspectContext(repoPath) {
  const rootResult = git(repoPath, ['rev-parse', '--show-toplevel'], { allowFailure: true });
  if (rootResult.status !== 0) {
    return unknownContext(repoPath, 'not-a-git-repository');
  }

  const currentRoot = rootResult.stdout.trim();
  const branch = getCurrentBranch(repoPath);
  const commit = getCurrentCommit(repoPath);
  const baseRoots = await candidateLabRoots(repoPath);
  const directBase = await hasLabConfig(currentRoot) ? currentRoot : null;
  const labRoot = directBase ?? baseRoots.find((candidate) => candidate !== currentRoot) ?? null;

  if (!labRoot) {
    return unknownContext(repoPath, 'no-owning-lab', { currentRoot, branch, commit });
  }

  const store = await loadCurrentStore(labRoot);
  const doctor = await runDoctor(labRoot);
  const privateLabIgnore = doctor.checks.find((check) => check.id === 'private-lab-ignore') ?? null;
  const matchingVariant = store.variants.find((variant) => (
    variant.worktreePath && resolve(variant.worktreePath) === resolve(currentRoot)
  )) ?? null;
  const role = directBase ? 'base-checkout' : matchingVariant ? 'registered-variant-worktree' : 'unknown-checkout';
  const activeVariant = matchingVariant ?? findVariant(store, store.config.activeVariantId);

  return {
    ok: true,
    role,
    repository: {
      name: basename(currentRoot),
      path: redactText(currentRoot),
      branch,
      commit,
    },
    labRoot: redactText(labRoot),
    experiment: role === 'unknown-checkout' ? null : {
      id: store.experiment.id,
      title: store.experiment.title,
    },
    activeVariant: role === 'unknown-checkout' || !activeVariant ? null : {
      id: activeVariant.id,
      name: activeVariant.name,
      branch: activeVariant.branch,
      worktreePath: activeVariant.worktreePath ? redactText(activeVariant.worktreePath) : null,
    },
    privateLabIgnore: privateLabIgnore ? {
      status: privateLabIgnore.status,
      message: privateLabIgnore.message,
    } : null,
    dirtyNonLabFiles: dirtyPathsOutsideLab(repoPath),
    next: nextSteps(role, activeVariant),
  };
}

export function formatContextReport(context) {
  const lines = [
    `Repository: ${context.repository?.name ?? 'unknown'}`,
    `Current branch: ${context.repository?.branch ?? 'unknown'}`,
    `Current checkout role: ${context.role}`,
    `Owning lab: ${context.experiment ? context.experiment.title : 'none'}`,
    `Experiment id: ${context.experiment?.id ?? 'none'}`,
    `Active variant: ${context.activeVariant ? context.activeVariant.name : 'none'}`,
    `Private lab ignore: ${context.privateLabIgnore?.status ?? 'unknown'}`,
    `Dirty non-lab files: ${context.dirtyNonLabFiles?.length ? context.dirtyNonLabFiles.join(', ') : 'none'}`,
    '',
    'Next:',
    ...context.next.map((step) => `  ${step}`),
    '',
  ];
  return lines.join('\n');
}

async function candidateLabRoots(repoPath) {
  const result = git(repoPath, ['worktree', 'list', '--porcelain'], { allowFailure: true });
  if (result.status !== 0) {
    return [];
  }
  const roots = parseWorktreePaths(result.stdout);
  const withLabs = [];
  for (const root of roots) {
    if (await hasLabConfig(root)) {
      withLabs.push(root);
    }
  }
  return withLabs;
}

function parseWorktreePaths(value) {
  return String(value)
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length).trim())
    .filter(Boolean);
}

async function hasLabConfig(root) {
  try {
    await access(join(root, '.agent-lab', 'config.json'));
    return true;
  } catch {
    return false;
  }
}

function unknownContext(repoPath, reason, current = {}) {
  return {
    ok: true,
    role: 'unknown-checkout',
    reason,
    repository: {
      name: current.currentRoot ? basename(current.currentRoot) : basename(repoPath),
      path: current.currentRoot ? redactText(current.currentRoot) : redactText(repoPath),
      branch: current.branch ?? null,
      commit: current.commit ?? null,
    },
    labRoot: null,
    experiment: null,
    activeVariant: null,
    privateLabIgnore: null,
    dirtyNonLabFiles: [],
    next: nextSteps('unknown-checkout'),
  };
}

function nextSteps(role, activeVariant = null) {
  if (role === 'registered-variant-worktree' && activeVariant) {
    return [
      `adl orchestrate ${activeVariant.name}`,
      `adl log response --variant ${activeVariant.name} --stdin`,
      `adl checkpoint --variant ${activeVariant.name} "checkpoint summary"`,
    ];
  }
  if (role === 'base-checkout') {
    return [
      'adl status',
      'adl worktree list',
      'adl orchestrate <variant>',
    ];
  }
  return [
    'Run adl doctor from the intended base repository.',
    'Run adl whereami from a registered ADL variant worktree or base checkout.',
  ];
}
