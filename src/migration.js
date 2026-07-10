import { readJson, loadCurrentStore, writeJson } from './store.js';
import { CURRENT_SCHEMA_VERSION, migrateDocumentToV2 } from './schema.js';
import { withLabLock } from './transaction.js';

export async function migrateLabStore(repoPath, options = {}) {
  const initialStore = await loadCurrentStore(repoPath);
  const run = async () => {
    const store = await loadCurrentStore(repoPath);
    const paths = [
      store.paths.configPath,
      store.paths.experimentPath,
      store.paths.treePath,
      store.paths.artifactsPath,
    ];
    const documents = await Promise.all(paths.map((path) => readJson(path)));
    const changed = documents
      .map((document, index) => ({ document, path: paths[index] }))
      .filter(({ document }) => document.schemaVersion !== CURRENT_SCHEMA_VERSION);
    const versions = new Set(documents.map((document) => document.schemaVersion));
    const from = versions.size === 1 ? documents[0].schemaVersion : 'mixed';

    if (!options.dryRun) {
      for (const { document, path } of changed) {
        await writeJson(path, migrateDocumentToV2(document));
      }
    }
    return {
      from,
      to: CURRENT_SCHEMA_VERSION,
      dryRun: options.dryRun === true,
      changedFiles: changed.map(({ path }) => path),
    };
  };

  if (options.dryRun) {
    return run();
  }
  return withLabLock(initialStore.labRoot, run);
}
