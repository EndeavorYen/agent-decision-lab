import { appendFile } from 'node:fs/promises';
import { makeEventId } from './ids.js';
import { loadCurrentStore } from './store.js';

const supportedTypes = new Set([
  'prompt',
  'response',
  'note',
  'checkpoint',
  'command',
  'artifact',
]);

export async function appendEvent(repoPath, input) {
  if (!supportedTypes.has(input?.type)) {
    throw new Error(`Unsupported event type: ${input?.type}`);
  }

  const store = await loadCurrentStore(repoPath);
  const event = {
    id: makeEventId(),
    type: input.type,
    experimentId: store.experiment.id,
    variantId: input.variantId ?? store.config.activeVariantId ?? null,
    createdAt: new Date().toISOString(),
    actor: input.actor ?? 'human',
    body: input.body ?? '',
    metadata: input.metadata ?? {},
  };

  await appendFile(store.paths.eventsPath, `${JSON.stringify(event)}\n`);
  return event;
}
