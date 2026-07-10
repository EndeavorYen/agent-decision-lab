import {
  appendFile,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const defaultTimeoutMs = 10_000;
const defaultStaleMs = 30_000;

export async function withLabLock(labRoot, callback, options = {}) {
  const labDir = join(labRoot, '.agent-lab');
  const lockDir = join(labDir, '.write-lock');
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const staleMs = options.staleMs ?? defaultStaleMs;
  const startedAt = Date.now();
  await mkdir(labDir, { recursive: true });

  while (true) {
    try {
      await mkdir(lockDir);
      await writeFile(join(lockDir, 'owner.json'), `${JSON.stringify({
        pid: process.pid,
        acquiredAt: new Date().toISOString(),
      })}\n`);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      if (await removeStaleLock(lockDir, staleMs)) {
        continue;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Timed out waiting for Agent Decision Lab write lock at ${lockDir}`);
      }
      await delay(20);
    }
  }

  try {
    return await callback();
  } finally {
    await rm(lockDir, { recursive: true, force: true });
  }
}

export async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, path);
  } finally {
    await handle?.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
  }
}

export async function appendJsonLine(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(value)}\n`, 'utf8');
}

async function removeStaleLock(lockDir, staleMs) {
  const owner = await readFile(join(lockDir, 'owner.json'), 'utf8')
    .then((value) => JSON.parse(value))
    .catch(() => null);
  const ownerAcquiredAt = owner?.acquiredAt ? Date.parse(owner.acquiredAt) : Number.NaN;
  const acquiredAt = Number.isFinite(ownerAcquiredAt)
    ? ownerAcquiredAt
    : await stat(lockDir).then((info) => info.mtimeMs).catch(() => Number.NaN);
  if (!Number.isFinite(acquiredAt) || Date.now() - acquiredAt <= staleMs) {
    return false;
  }
  if (Number.isInteger(owner?.pid) && processIsAlive(owner.pid)) {
    return false;
  }
  const stalePath = `${lockDir}.stale.${process.pid}.${randomUUID()}`;
  try {
    await rename(lockDir, stalePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true;
    }
    return false;
  }
  await rm(stalePath, { recursive: true, force: true });
  return true;
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
