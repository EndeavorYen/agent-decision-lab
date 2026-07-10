import { makeEventId } from './ids.js';
import { loadCurrentStore, resolveInvocationVariant } from './store.js';
import { appendJsonLine, withLabLock } from './transaction.js';

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

  const initialStore = await loadCurrentStore(repoPath);
  return withLabLock(initialStore.labRoot, async () => {
    const store = await loadCurrentStore(repoPath);
    const event = {
      id: makeEventId(),
      type: input.type,
      experimentId: store.experiment.id,
      variantId: input.variantId
        ?? resolveInvocationVariant(store)?.id
        ?? store.config.activeVariantId
        ?? null,
      createdAt: new Date().toISOString(),
      actor: input.actor ?? 'human',
      body: input.body ?? '',
      metadata: input.metadata ?? {},
    };

    await appendJsonLine(store.paths.eventsPath, event);
    return event;
  });
}
