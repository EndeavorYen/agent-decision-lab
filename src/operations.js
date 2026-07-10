import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CURRENT_SCHEMA_VERSION } from './schema.js';
import { writeJsonAtomic } from './transaction.js';

export async function beginOperation(store, input) {
  const now = new Date().toISOString();
  const operation = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: `op_${Date.now()}_${randomUUID().slice(0, 8)}`,
    type: input.type,
    status: 'prepared',
    variantId: input.variantId ?? null,
    variantName: input.variantName ?? null,
    branch: input.branch ?? null,
    worktreePath: input.worktreePath ?? null,
    baseCommit: input.baseCommit ?? null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  await writeOperation(store, operation);
  return operation;
}

export async function completeOperation(store, operation) {
  return updateOperation(store, operation, { status: 'complete', error: null });
}

export async function failOperation(store, operation, error) {
  return updateOperation(store, operation, {
    status: 'failed',
    error: {
      name: error?.name ?? 'Error',
      message: error?.message ?? String(error),
    },
  });
}

async function updateOperation(store, operation, changes) {
  const updated = {
    ...operation,
    ...changes,
    updatedAt: new Date().toISOString(),
  };
  await writeOperation(store, updated);
  return updated;
}

async function writeOperation(store, operation) {
  await writeJsonAtomic(join(store.paths.operationsDir, `${operation.id}.json`), operation);
}
