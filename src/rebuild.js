import { access, rm } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { createWorktree, dirtyPathsOutsideLab, git } from './git.js';
import {
  createDecision,
  createExperimentStore,
  createSavepoint,
  startVariant,
} from './store.js';
import { setStrategy } from './strategy.js';
import { slugify } from './ids.js';

export async function createRebuildLab(repoPath, input) {
  if (!input.title) {
    throw new Error('Rebuild title is required');
  }
  if (input.keep.length === 0) {
    throw new Error('At least one --keep file is required');
  }
  const dirty = dirtyPathsOutsideLab(repoPath);
  if (dirty.length > 0) {
    throw new Error(`Cannot create rebuild lab with dirty working tree: ${dirty.join(', ')}`);
  }
  for (const keep of input.keep) {
    await assertExists(join(repoPath, keep), `Keep file not found: ${keep}`);
  }

  const slug = slugify(input.title);
  const baseRef = input.base ?? 'HEAD';
  const branch = input.branch ?? `adl/rebuild/${slug}/base`;
  const baseWorktree = resolve(repoPath, input.baseWorktree ?? `../${basename(repoPath)}-rebuild-${slug}`);
  createWorktree(repoPath, baseWorktree, branch, baseRef);

  const tracked = git(baseWorktree, ['ls-files', '-z']).stdout
    .split('\0')
    .filter(Boolean);
  const keepSet = new Set(input.keep.map(normalizePath));
  for (const file of tracked) {
    if (!keepSet.has(normalizePath(file))) {
      await rm(join(baseWorktree, file), { recursive: true, force: true });
    }
  }

  git(baseWorktree, ['add', '-A']);
  git(baseWorktree, ['commit', '--allow-empty', '-m', 'chore: create ADL rebuild baseline']);

  await createExperimentStore(baseWorktree, {
    title: input.title,
    description: 'Blank rebuild strategy lab created by adl rebuild init.',
  });
  const decision = await createDecision(baseWorktree, {
    title: input.decision ?? 'Context strategy',
    rationale: input.rationale ?? 'Compare rebuild strategies from one blank baseline.',
  });
  const savepoint = await createSavepoint(baseWorktree, {
    title: input.savepoint ?? 'Blank baseline',
    decision: decision.id,
  });

  const variants = [];
  for (const name of input.variants) {
    const variant = await startVariant(baseWorktree, {
      name,
      from: savepoint.id,
      createWorktree: input.worktree,
      createBranch: true,
    });
    await setStrategy(baseWorktree, {
      variant: variant.id,
      from: savepoint.id,
      contextPolicy: name,
      hypothesis: `${name} rebuild strategy from blank baseline`,
      controls: ['same blank baseline commit'],
    });
    variants.push(variant);
  }

  return {
    baseWorktree,
    savepoint,
    variants,
  };
}

async function assertExists(path, message) {
  try {
    await access(path);
  } catch {
    throw new Error(message);
  }
}

function normalizePath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\/+/, '');
}
