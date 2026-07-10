import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import {
  branchExists,
  checkoutBranch,
  checkoutNewBranch,
  createBranch,
  createWorktree,
  dirtyPathsOutsideLab,
  git,
  getCurrentBranch,
  getCurrentCommit,
  getRepoMetadata,
} from './git.js';
import { makeExperimentId, makeNodeId, slugify } from './ids.js';
import { beginOperation, completeOperation, failOperation } from './operations.js';
import {
  bumpRevision,
  CURRENT_SCHEMA_VERSION,
  validateConfig,
  validateStoreDocuments,
  validateStoreRecords,
} from './schema.js';
import { withLabLock, writeJsonAtomic } from './transaction.js';

export const schemaVersion = CURRENT_SCHEMA_VERSION;

export async function createExperimentStore(repoPath, input) {
  return createExperiment(repoPath, input, { allowExistingLab: false });
}

export async function createNewExperimentStore(repoPath, input) {
  return createExperiment(repoPath, input, { allowExistingLab: true });
}

async function createExperiment(repoPath, input, options) {
  if (!input?.title) {
    throw new Error('Experiment title is required');
  }

  const labRoot = getRepoMetadata(repoPath).path;
  return withLabLock(labRoot, () => createExperimentUnlocked(labRoot, input, options));
}

async function createExperimentUnlocked(repoPath, input, options) {

  const labDir = join(repoPath, '.agent-lab');
  const configPath = join(labDir, 'config.json');
  const configExists = await exists(configPath);
  if (configExists && !options.allowExistingLab) {
    throw new Error('.agent-lab/config.json already exists; use adl status to inspect it');
  }

  const id = await uniqueExperimentId(repoPath, input.title);
  const experimentDir = join(labDir, 'experiments', id);
  const repoMetadata = getRepoMetadata(repoPath);
  const now = new Date().toISOString();
  const experiment = {
    schemaVersion,
    revision: 0,
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
  await mkdir(join(experimentDir, 'savepoints'), { recursive: true });
  await mkdir(join(experimentDir, 'strategies'), { recursive: true });
  await mkdir(join(experimentDir, 'rubrics'), { recursive: true });
  await mkdir(join(experimentDir, 'evaluations'), { recursive: true });
  await mkdir(join(experimentDir, 'comparisons'), { recursive: true });
  await mkdir(join(experimentDir, 'operations'), { recursive: true });
  await mkdir(join(experimentDir, 'exports'), { recursive: true });
  const config = configExists
    ? {
      ...await readJson(configPath),
      schemaVersion,
      revision: 0,
      currentExperimentId: id,
      activeVariantId: null,
      updatedAt: now,
    }
    : {
      schemaVersion,
      revision: 0,
      currentExperimentId: id,
      activeVariantId: null,
      createdAt: now,
      updatedAt: now,
    };
  await writeJson(configPath, config);
  await writeJson(join(experimentDir, 'experiment.json'), experiment);
  await writeJson(join(experimentDir, 'tree.json'), {
    schemaVersion,
    revision: 0,
    experimentId: id,
    nodes: [],
  });
  await writeJson(join(experimentDir, 'artifacts.json'), {
    schemaVersion,
    revision: 0,
    experimentId: id,
    artifacts: [],
  });
  await writeFile(join(experimentDir, 'events.jsonl'), '');

  return experiment;
}

export async function listExperimentStores(repoPath) {
  const experimentsDir = join(repoPath, '.agent-lab', 'experiments');
  if (!await exists(experimentsDir)) {
    return [];
  }
  const dirs = (await readdir(experimentsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const experiments = [];
  for (const dir of dirs) {
    const path = join(experimentsDir, dir, 'experiment.json');
    if (await exists(path)) {
      experiments.push(await readJson(path));
    }
  }
  return experiments.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function switchExperimentStore(repoPath, value) {
  const initialStore = await loadCurrentStore(repoPath);
  return withLabLock(initialStore.labRoot, async () => {
  const labDir = join(initialStore.labRoot, '.agent-lab');
  const configPath = join(labDir, 'config.json');
  const config = await readJson(configPath);
  const experiments = await listExperimentStores(initialStore.labRoot);
  const normalized = slugify(value);
  const experiment = experiments.find((record) => (
    record.id === value
    || record.id === `exp_${normalized}`
    || record.title === value
    || slugify(record.title) === normalized
  ));
  if (!experiment) {
    throw new Error(`Experiment not found: ${value}`);
  }
  config.currentExperimentId = experiment.id;
  config.activeVariantId = null;
  config.updatedAt = new Date().toISOString();
  bumpRevision(config);
  await writeJson(configPath, config);
  return experiment;
  });
}

export async function loadCurrentStore(repoPath) {
  const invocationPath = getRepoMetadata(repoPath).path;
  const labRoot = await resolveLabRoot(repoPath);
  return await loadCurrentStoreDirect(labRoot, invocationPath);
}

async function loadCurrentStoreDirect(repoPath, invocationPath = repoPath) {
  const labDir = join(repoPath, '.agent-lab');
  const config = await readJson(join(labDir, 'config.json'));
  validateConfig(config);
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
    savepointsDir: join(experimentDir, 'savepoints'),
    strategiesDir: join(experimentDir, 'strategies'),
    rubricsDir: join(experimentDir, 'rubrics'),
    evaluationsDir: join(experimentDir, 'evaluations'),
    comparisonsDir: join(experimentDir, 'comparisons'),
    operationsDir: join(experimentDir, 'operations'),
    exportsDir: join(experimentDir, 'exports'),
    guidancePath: join(experimentDir, 'exports', 'guidance.json'),
  };

  const experiment = await readJson(paths.experimentPath);
  const tree = await readJson(paths.treePath);
  const artifacts = await readJson(paths.artifactsPath);
  validateStoreDocuments({ config, experiment, tree, artifacts });
  const events = await readEvents(paths.eventsPath);
  const variants = await readVariants(paths.variantsDir);
  const savepoints = await readJsonDir(paths.savepointsDir);
  const strategies = await readJsonDir(paths.strategiesDir);
  const rubrics = await readJsonDir(paths.rubricsDir);
  const evaluations = await readJsonDir(paths.evaluationsDir);
  const comparisons = await readJsonDir(paths.comparisonsDir);
  const operations = await readJsonDir(paths.operationsDir);
  const guidanceDrafts = await readOptionalRecord(paths.guidancePath);

  const store = {
    repoPath,
    labRoot: repoPath,
    invocationPath,
    paths,
    config,
    experiment,
    tree,
    artifacts,
    events,
    variants,
    savepoints,
    strategies,
    rubrics,
    evaluations,
    comparisons,
    operations,
    guidanceDrafts,
  };
  validateStoreRecords(store);
  return store;
}

export function resolveInvocationVariant(store) {
  if (resolve(store.invocationPath) === resolve(store.labRoot)) {
    return null;
  }
  return store.variants.find((variant) => (
    variant.worktreePath
    && resolve(variant.worktreePath) === resolve(store.invocationPath)
  )) ?? null;
}

async function resolveLabRoot(repoPath) {
  const root = getRepoMetadata(repoPath).path;
  if (await exists(join(root, '.agent-lab', 'config.json'))) {
    return root;
  }

  const worktrees = git(repoPath, ['worktree', 'list', '--porcelain'], { allowFailure: true });
  if (worktrees.status === 0) {
    for (const candidate of parseWorktreePaths(worktrees.stdout)) {
      if (!await exists(join(candidate, '.agent-lab', 'config.json'))) {
        continue;
      }
      const store = await loadCurrentStoreDirect(candidate);
      const ownsCurrentWorktree = store.variants.some((variant) => (
        variant.worktreePath && resolve(variant.worktreePath) === resolve(root)
      ));
      if (ownsCurrentWorktree) {
        return candidate;
      }
    }
  }

  throw new Error(
    `ADL lab metadata not found for ${root}. Run this command from the base lab worktree, or use a registered ADL variant worktree.`,
  );
}

function parseWorktreePaths(value) {
  return String(value)
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length).trim())
    .filter(Boolean);
}

export async function createDecision(repoPath, input) {
  if (!input?.title) {
    throw new Error('Decision title is required');
  }
  return withCurrentStoreLock(repoPath, async (store) => {
  const id = uniqueNodeId(store.tree.nodes, makeNodeId('dec', input.title));
  const now = new Date().toISOString();
  const decision = {
    id,
    type: 'decision',
    title: input.title,
    rationale: input.rationale ?? '',
    parentId: input.parentId ?? input.parent ?? 'root',
    createdAt: now,
  };

  store.tree.nodes.push(decision);
  bumpRevision(store.tree);
  await writeJson(store.paths.treePath, store.tree);
  return decision;
  });
}

export async function createSavepoint(repoPath, input) {
  if (!input?.title) {
    throw new Error('Savepoint title is required');
  }
  return withCurrentStoreLock(repoPath, async (store) => {
  const decision = resolveDecision(store.tree.nodes, input.decision);
  if (!decision) {
    throw new Error(`Decision not found: ${input.decision}`);
  }

  const dirty = dirtyPathsOutsideLab(repoPath);
  const forkable = input.forkable ?? true;
  if (forkable && dirty.length > 0) {
    throw new Error(
      `Cannot create forkable savepoint with uncommitted changes outside .agent-lab: ${dirty.join(', ')}`,
    );
  }

  const id = uniqueNodeId(store.tree.nodes, makeNodeId('sp', input.title));
  const now = new Date().toISOString();
  const savepoint = {
    id,
    type: 'savepoint',
    decisionId: decision.id,
    title: input.title,
    rationale: input.rationale ?? '',
    git: {
      commit: getCurrentCommit(repoPath),
      branch: getCurrentBranch(repoPath),
      isDirty: dirty.length > 0,
    },
    context: {
      policy: input.contextPolicy ?? 'pre-decision',
      artifacts: input.artifactRefs ?? [],
    },
    parentId: decision.id,
    parentVariantId: input.parentVariantId ?? store.config.activeVariantId ?? null,
    forkable: forkable && dirty.length === 0,
    createdAt: now,
  };

  store.tree.nodes.push({
    id: savepoint.id,
    type: 'savepoint',
    decisionId: savepoint.decisionId,
    parentId: savepoint.parentId,
    title: savepoint.title,
    git: savepoint.git,
    forkable: savepoint.forkable,
    createdAt: savepoint.createdAt,
  });

  bumpRevision(store.tree);
  await writeJson(join(store.paths.savepointsDir, `${savepoint.id}.json`), savepoint);
  await writeJson(store.paths.treePath, store.tree);
  return savepoint;
  });
}

export async function startVariant(repoPath, input) {
  if (!input?.name) {
    throw new Error('Variant name is required');
  }
  return withCurrentStoreLock(repoPath, async (store) => {
  const savepoint = input.from || input.savepointId
    ? resolveSavepoint(store.savepoints, input.from ?? input.savepointId)
    : null;
  if ((input.from || input.savepointId) && !savepoint) {
    throw new Error(`Savepoint not found: ${input.from ?? input.savepointId}`);
  }
  if (savepoint && !savepoint.forkable) {
    throw new Error(`Savepoint is not cleanly forkable: ${savepoint.id}`);
  }

  const decision = savepoint
    ? resolveDecision(store.tree.nodes, savepoint.decisionId)
    : resolveDecision(store.tree.nodes, input.decision);
  if (!decision) {
    throw new Error(`Decision not found: ${input.decision}`);
  }

  const createBranchRequested = input.createBranch ?? true;
  const createWorktreeRequested = input.createWorktree ?? false;
  const checkoutCurrentWorktree = !createWorktreeRequested && (input.attach || createBranchRequested);
  const requiresCleanWorktree = checkoutCurrentWorktree
    || (!savepoint && (createBranchRequested || createWorktreeRequested) && !input.attach);
  if (requiresCleanWorktree) {
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
  const baseCommit = input.baseCommit ?? savepoint?.git?.commit ?? store.experiment.baseRepository.baseCommit;
  let worktreePath = input.worktreePath ? resolve(repoPath, input.worktreePath) : null;
  if (createWorktreeRequested && !worktreePath) {
    worktreePath = resolve(
      repoPath,
      '..',
      `${basename(repoPath)}-agent-lab`,
      experimentSlug,
      variantSlug,
    );
  }
  if (input.attach && branch && !branchExists(repoPath, branch)) {
    throw new Error(`Cannot attach missing branch: ${branch}`);
  }
  if (!input.attach && createWorktreeRequested && await exists(worktreePath)) {
    throw new Error(`Worktree path already exists: ${worktreePath}`);
  }
  if (!input.attach && !createWorktreeRequested && createBranchRequested && branchExists(repoPath, branch)) {
    throw new Error(`Branch already exists: ${branch}`);
  }

  const operation = await beginOperation(store, {
    type: 'start-variant',
    variantId: id,
    variantName: input.name,
    branch,
    worktreePath,
    baseCommit,
  });

  try {
  if (!input.attach && createWorktreeRequested) {
    if (await exists(worktreePath)) {
      throw new Error(`Worktree path already exists: ${worktreePath}`);
    }
    createWorktree(repoPath, worktreePath, branch, baseCommit);
  } else if (!input.attach && createBranchRequested) {
    createBranch(repoPath, branch, baseCommit);
  }
  if (checkoutCurrentWorktree) {
    checkoutBranch(repoPath, branch);
  }

  const now = new Date().toISOString();
  const variant = {
    id,
    type: 'variant',
    decisionId: decision.id,
    savepointId: savepoint?.id ?? null,
    parentId: savepoint?.id ?? decision.id,
    name: input.name,
    promptSummary: input.promptSummary ?? '',
    branch,
    worktreePath,
    baseCommit,
    currentCommit: getCurrentCommit(repoPath, branch),
    parentVariantId: savepoint ? savepoint.parentVariantId ?? null : store.config.activeVariantId,
    status: 'active',
    createdAt: now,
  };

  store.tree.nodes.push({
    id: variant.id,
    type: 'variant',
    decisionId: variant.decisionId,
    savepointId: variant.savepointId,
    parentId: variant.parentId,
    name: variant.name,
    branch: variant.branch,
    worktreePath: variant.worktreePath,
    createdAt: variant.createdAt,
  });
  store.config.activeVariantId = variant.id;
  store.config.updatedAt = now;
  bumpRevision(store.tree);
  bumpRevision(store.config);

  await writeJson(join(store.paths.variantsDir, `${variant.id}.json`), variant);
  await writeJson(store.paths.treePath, store.tree);
  await writeJson(store.paths.configPath, store.config);
  await completeOperation(store, {
    ...operation,
    worktreePath: variant.worktreePath,
  });

  return variant;
  } catch (error) {
    await failOperation(store, operation, error).catch(() => {});
    throw error;
  }
  });
}

export async function checkoutVariant(repoPath, input) {
  return withCurrentStoreLock(repoPath, async (store) => {
  const variant = findVariant(store, input.variant ?? input.name);
  if (!variant) {
    throw new Error(`Variant not found: ${input.variant ?? input.name}`);
  }

  const dirty = dirtyPathsOutsideLab(repoPath);
  if (!input.force && dirty.length > 0) {
    throw new Error(
      `Cannot checkout variant with uncommitted changes outside .agent-lab: ${dirty.join(', ')}`,
    );
  }

  const operation = await beginOperation(store, {
    type: 'checkout-variant',
    variantId: variant.id,
    variantName: variant.name,
    branch: variant.branch,
    worktreePath: variant.worktreePath,
    baseCommit: variant.baseCommit,
  });
  try {
  if (!variant.worktreePath) {
    checkoutBranch(repoPath, variant.branch);
  }
  store.config.activeVariantId = variant.id;
  await saveConfigUnlocked(store);
  await completeOperation(store, operation);
  return variant;
  } catch (error) {
    await failOperation(store, operation, error).catch(() => {});
    throw error;
  }
  });
}

export async function checkoutSavepoint(repoPath, input) {
  return withCurrentStoreLock(repoPath, async (store) => {
  const savepoint = findSavepoint(store, input.savepoint ?? input.name);
  if (!savepoint) {
    throw new Error(`Savepoint not found: ${input.savepoint ?? input.name}`);
  }
  const dirty = dirtyPathsOutsideLab(repoPath);
  if (!input.force && dirty.length > 0) {
    throw new Error(
      `Cannot checkout savepoint with uncommitted changes outside .agent-lab: ${dirty.join(', ')}`,
    );
  }

  const branch = input.branch ?? `adl/${slugify(store.experiment.title)}/savepoints/${slugify(savepoint.title)}`;
  const operation = await beginOperation(store, {
    type: 'checkout-savepoint',
    variantId: null,
    variantName: null,
    branch,
    worktreePath: null,
    baseCommit: savepoint.git.commit,
  });
  try {
  checkoutNewBranch(repoPath, branch, savepoint.git.commit);
  store.config.activeVariantId = null;
  await saveConfigUnlocked(store);
  await completeOperation(store, operation);
  return { savepoint, branch };
  } catch (error) {
    await failOperation(store, operation, error).catch(() => {});
    throw error;
  }
  });
}

export async function saveConfig(store) {
  return withLabLock(store.labRoot ?? store.repoPath, async () => {
    const current = await readJson(store.paths.configPath);
    if (current.currentExperimentId !== store.config.currentExperimentId) {
      store.config = current;
      return current;
    }
    current.activeVariantId = store.config.activeVariantId;
    store.config = current;
    await saveConfigUnlocked(store);
    return store.config;
  });
}

async function saveConfigUnlocked(store) {
  store.config.updatedAt = new Date().toISOString();
  bumpRevision(store.config);
  await writeJson(store.paths.configPath, store.config);
}

export async function writeJson(path, value) {
  await writeJsonAtomic(path, value);
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function findVariant(store, value) {
  if (!value) {
    return null;
  }
  const normalized = slugify(value);
  return store.variants.find((variant) => (
    variant.id === value
    || variant.name === value
    || slugify(variant.name) === normalized
    || variant.id === `var_${normalized}`
  )) ?? null;
}

export function findSavepoint(store, value) {
  return resolveSavepoint(store.savepoints, value);
}

async function readEvents(path) {
  const body = await readFile(path, 'utf8');
  return body
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function readVariants(path) {
  return readJsonDir(path);
}

async function readJsonDir(path) {
  if (!await exists(path)) {
    return [];
  }
  const files = (await readdir(path)).filter((file) => file.endsWith('.json')).sort();
  const records = [];
  for (const file of files) {
    records.push(await readJson(join(path, file)));
  }
  return records;
}

async function readOptionalRecord(path) {
  if (!await exists(path)) {
    return [];
  }
  return [await readJson(path)];
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

function resolveSavepoint(savepoints, value) {
  if (!value) {
    return null;
  }
  const normalized = slugify(value);
  return savepoints.find((savepoint) => (
    savepoint.id === value
    || savepoint.id === `sp_${normalized}`
    || slugify(savepoint.title) === normalized
  )) ?? null;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function withCurrentStoreLock(repoPath, callback) {
  const initialStore = await loadCurrentStore(repoPath);
  return withLabLock(initialStore.labRoot, async () => {
    const store = await loadCurrentStore(repoPath);
    return callback(store);
  });
}

function dirnameOf(path) {
  return path.slice(0, path.lastIndexOf('/')) || '.';
}
