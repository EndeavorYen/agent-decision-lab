import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import {
  branchExists,
  createBranch,
  createWorktree,
  dirtyPathsOutsideLab,
  getCurrentCommit,
  getRepoMetadata,
} from './git.js';
import { makeExperimentId, makeNodeId, slugify } from './ids.js';

export const schemaVersion = 'agent-decision-lab/v1';

export async function createExperimentStore(repoPath, input) {
  if (!input?.title) {
    throw new Error('Experiment title is required');
  }

  const labDir = join(repoPath, '.agent-lab');
  const configPath = join(labDir, 'config.json');
  if (await exists(configPath)) {
    throw new Error('.agent-lab/config.json already exists; use adl status to inspect it');
  }

  const id = await uniqueExperimentId(repoPath, input.title);
  const experimentDir = join(labDir, 'experiments', id);
  const repoMetadata = getRepoMetadata(repoPath);
  const now = new Date().toISOString();
  const experiment = {
    schemaVersion,
    id,
    title: input.title,
    description: input.description ?? '',
    owner: input.owner ?? null,
    createdAt: now,
    baseRepository: repoMetadata,
    privacy: {
      classification: 'private',
      redactionProfile: 'default',
    },
  };

  await mkdir(join(experimentDir, 'variants'), { recursive: true });
  await mkdir(join(experimentDir, 'exports'), { recursive: true });
  await writeJson(configPath, {
    schemaVersion,
    currentExperimentId: id,
    activeVariantId: null,
    createdAt: now,
    updatedAt: now,
  });
  await writeJson(join(experimentDir, 'experiment.json'), experiment);
  await writeJson(join(experimentDir, 'tree.json'), {
    schemaVersion,
    experimentId: id,
    nodes: [],
  });
  await writeJson(join(experimentDir, 'artifacts.json'), {
    schemaVersion,
    experimentId: id,
    artifacts: [],
  });
  await writeFile(join(experimentDir, 'events.jsonl'), '');

  return experiment;
}

export async function loadCurrentStore(repoPath) {
  const labDir = join(repoPath, '.agent-lab');
  const config = await readJson(join(labDir, 'config.json'));
  const experimentDir = join(labDir, 'experiments', config.currentExperimentId);
  const paths = {
    labDir,
    configPath: join(labDir, 'config.json'),
    experimentDir,
    experimentPath: join(experimentDir, 'experiment.json'),
    treePath: join(experimentDir, 'tree.json'),
    artifactsPath: join(experimentDir, 'artifacts.json'),
    eventsPath: join(experimentDir, 'events.jsonl'),
    variantsDir: join(experimentDir, 'variants'),
    exportsDir: join(experimentDir, 'exports'),
  };

  const experiment = await readJson(paths.experimentPath);
  const tree = await readJson(paths.treePath);
  const artifacts = await readJson(paths.artifactsPath);
  const events = await readEvents(paths.eventsPath);
  const variants = await readVariants(paths.variantsDir);

  return { repoPath, paths, config, experiment, tree, artifacts, events, variants };
}

export async function createDecision(repoPath, input) {
  if (!input?.title) {
    throw new Error('Decision title is required');
  }
  const store = await loadCurrentStore(repoPath);
  const id = uniqueNodeId(store.tree.nodes, makeNodeId('dec', input.title));
  const now = new Date().toISOString();
  const decision = {
    id,
    type: 'decision',
    title: input.title,
    rationale: input.rationale ?? '',
    parentId: input.parentId ?? 'root',
    createdAt: now,
  };

  store.tree.nodes.push(decision);
  await writeJson(store.paths.treePath, store.tree);
  return decision;
}

export async function startVariant(repoPath, input) {
  if (!input?.name) {
    throw new Error('Variant name is required');
  }
  const store = await loadCurrentStore(repoPath);
  const decision = resolveDecision(store.tree.nodes, input.decision);
  if (!decision) {
    throw new Error(`Decision not found: ${input.decision}`);
  }

  const createBranchRequested = input.createBranch ?? true;
  const createWorktreeRequested = input.createWorktree ?? false;
  if ((createBranchRequested || createWorktreeRequested) && !input.attach) {
    const dirty = dirtyPathsOutsideLab(repoPath);
    if (dirty.length > 0) {
      throw new Error(
        `Cannot start variant with uncommitted changes outside .agent-lab: ${dirty.join(', ')}`,
      );
    }
  }

  const id = uniqueNodeId(store.tree.nodes, makeNodeId('var', input.name));
  const variantSlug = slugify(input.name);
  const experimentSlug = slugify(store.experiment.title);
  const branch = input.branch ?? `adl/${experimentSlug}/${variantSlug}`;
  const baseCommit = input.baseCommit ?? store.experiment.baseRepository.baseCommit;
  let worktreePath = input.worktreePath ? resolve(repoPath, input.worktreePath) : null;

  if (input.attach) {
    if (branch && !branchExists(repoPath, branch)) {
      throw new Error(`Cannot attach missing branch: ${branch}`);
    }
  } else if (createWorktreeRequested) {
    worktreePath ??= resolve(
      repoPath,
      '..',
      `${basename(repoPath)}-agent-lab`,
      experimentSlug,
      variantSlug,
    );
    if (await exists(worktreePath)) {
      throw new Error(`Worktree path already exists: ${worktreePath}`);
    }
    createWorktree(repoPath, worktreePath, branch, baseCommit);
  } else if (createBranchRequested) {
    createBranch(repoPath, branch, baseCommit);
  }

  const now = new Date().toISOString();
  const variant = {
    id,
    type: 'variant',
    decisionId: decision.id,
    parentId: decision.id,
    name: input.name,
    promptSummary: input.promptSummary ?? '',
    branch,
    worktreePath,
    baseCommit,
    currentCommit: getCurrentCommit(repoPath, branch),
    parentVariantId: store.config.activeVariantId,
    status: 'active',
    createdAt: now,
  };

  store.tree.nodes.push({
    id: variant.id,
    type: 'variant',
    decisionId: variant.decisionId,
    parentId: variant.parentId,
    name: variant.name,
    branch: variant.branch,
    worktreePath: variant.worktreePath,
    createdAt: variant.createdAt,
  });
  store.config.activeVariantId = variant.id;
  store.config.updatedAt = now;

  await writeJson(join(store.paths.variantsDir, `${variant.id}.json`), variant);
  await writeJson(store.paths.treePath, store.tree);
  await writeJson(store.paths.configPath, store.config);

  return variant;
}

export async function saveConfig(store) {
  store.config.updatedAt = new Date().toISOString();
  await writeJson(store.paths.configPath, store.config);
}

export async function writeJson(path, value) {
  await mkdir(dirnameOf(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readEvents(path) {
  const body = await readFile(path, 'utf8');
  return body
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function readVariants(path) {
  if (!await exists(path)) {
    return [];
  }
  const files = (await readdir(path)).filter((file) => file.endsWith('.json')).sort();
  const variants = [];
  for (const file of files) {
    variants.push(await readJson(join(path, file)));
  }
  return variants;
}

async function uniqueExperimentId(repoPath, title) {
  const base = makeExperimentId(title);
  let candidate = base;
  let suffix = 2;
  while (await exists(join(repoPath, '.agent-lab', 'experiments', candidate))) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function uniqueNodeId(nodes, base) {
  const ids = new Set(nodes.map((node) => node.id));
  let candidate = base;
  let suffix = 2;
  while (ids.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function resolveDecision(nodes, value) {
  if (!value) {
    return null;
  }
  const normalized = slugify(value);
  return nodes.find((node) => {
    if (node.type !== 'decision') {
      return false;
    }
    return node.id === value || node.id === `dec_${normalized}` || slugify(node.title) === normalized;
  }) ?? null;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function dirnameOf(path) {
  return path.slice(0, path.lastIndexOf('/')) || '.';
}
