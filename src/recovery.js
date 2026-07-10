import { access } from 'node:fs/promises';
import { branchExists } from './git.js';
import { loadCurrentStore } from './store.js';

export async function inspectRecovery(repoPath) {
  const store = await loadCurrentStore(repoPath);
  const pending = [];
  for (const operation of store.operations.filter((record) => record.status !== 'complete')) {
    const hasBranch = operation.branch
      ? branchExists(store.labRoot, operation.branch)
      : false;
    const hasWorktree = operation.worktreePath
      ? await exists(operation.worktreePath)
      : false;
    const metadataExists = store.variants.some((variant) => variant.id === operation.variantId);
    pending.push({
      ...operation,
      branchExists: hasBranch,
      worktreeExists: hasWorktree,
      metadataExists,
      action: recoveryAction({ operation, hasBranch, hasWorktree, metadataExists }),
    });
  }
  return {
    schemaVersion: 'agent-decision-lab/recovery-report/v1',
    pending,
    safeToContinue: pending.length === 0,
  };
}

export function formatRecoveryPlan(report) {
  const lines = ['Agent Decision Lab repair dry-run', ''];
  if (report.pending.length === 0) {
    lines.push('No incomplete operations.', '');
    return lines.join('\n');
  }
  for (const operation of report.pending) {
    lines.push(
      `${operation.id} ${operation.status} ${operation.variantId ?? 'no variant'}`,
      `  branch: ${operation.branch ?? 'none'} (${operation.branchExists ? 'exists' : 'missing'})`,
      `  worktree: ${operation.worktreePath ?? 'none'} (${operation.worktreeExists ? 'exists' : 'missing'})`,
      `  metadata: ${operation.metadataExists ? 'exists' : 'missing'}`,
      `  proposed action: ${operation.action}`,
    );
  }
  lines.push('', 'No changes were made.', '');
  return lines.join('\n');
}

function recoveryAction({ operation, hasBranch, hasWorktree, metadataExists }) {
  if (operation.type === 'checkout-variant') {
    return `review the current checkout and active variant ${operation.variantName ?? operation.variantId}`;
  }
  if (operation.type === 'checkout-savepoint') {
    return `review the current checkout and savepoint branch ${operation.branch}`;
  }
  if (metadataExists && (hasBranch || hasWorktree)) {
    return 'review the recorded variant and mark the operation complete';
  }
  if (!metadataExists && (hasBranch || hasWorktree)) {
    return `review the Git state, then attach variant ${operation.variantName ?? operation.variantId}`;
  }
  return `retry creation of variant ${operation.variantName ?? operation.variantId}`;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
