export const LEGACY_SCHEMA_VERSION = 'agent-decision-lab/v1';
export const CURRENT_SCHEMA_VERSION = 'agent-decision-lab/v2';

const supportedVersions = new Set([
  LEGACY_SCHEMA_VERSION,
  CURRENT_SCHEMA_VERSION,
]);

export function validateConfig(config) {
  assertObject(config, 'config');
  assertSupportedVersion(config.schemaVersion);
  assertNonEmptyString(config.currentExperimentId, 'config', 'currentExperimentId');
  validateRevision(config, 'config');
}

export function validateStoreDocuments({ config, experiment, tree, artifacts }) {
  validateConfig(config);
  assertObject(experiment, 'experiment');
  assertSupportedVersion(experiment.schemaVersion);
  assertNonEmptyString(experiment.id, 'experiment', 'id');
  assertNonEmptyString(experiment.title, 'experiment', 'title');
  validateRevision(experiment, 'experiment');

  assertObject(tree, 'tree');
  assertSupportedVersion(tree.schemaVersion);
  assertNonEmptyString(tree.experimentId, 'tree', 'experimentId');
  if (!Array.isArray(tree.nodes)) {
    throw new Error('Invalid tree: nodes must be an array');
  }
  validateRevision(tree, 'tree');

  assertObject(artifacts, 'artifacts');
  assertSupportedVersion(artifacts.schemaVersion);
  assertNonEmptyString(artifacts.experimentId, 'artifacts', 'experimentId');
  if (!Array.isArray(artifacts.artifacts)) {
    throw new Error('Invalid artifacts: artifacts must be an array');
  }
  validateRevision(artifacts, 'artifacts');

  if (config.currentExperimentId !== experiment.id) {
    throw new Error('Invalid store: config currentExperimentId does not match experiment id');
  }
  if (tree.experimentId !== experiment.id || artifacts.experimentId !== experiment.id) {
    throw new Error('Invalid store: aggregate experiment ids do not match');
  }
}

export function validateStoreRecords(store) {
  const decisionIds = new Set(
    store.tree.nodes.filter((node) => node.type === 'decision').map((node) => node.id),
  );
  const savepointIds = new Set(store.savepoints.map((record) => record.id));
  for (const savepoint of store.savepoints) {
    assertRecord(savepoint, 'savepoint');
    if (!decisionIds.has(savepoint.decisionId)) {
      throw new Error(`Invalid savepoint ${savepoint.id}: decision ${savepoint.decisionId} not found`);
    }
  }
  for (const variant of store.variants) {
    assertRecord(variant, 'variant');
    if (!decisionIds.has(variant.decisionId)) {
      throw new Error(`Invalid variant ${variant.id}: decision ${variant.decisionId} not found`);
    }
    if (variant.savepointId && !savepointIds.has(variant.savepointId)) {
      throw new Error(`Invalid variant ${variant.id}: savepoint ${variant.savepointId} not found`);
    }
  }
  for (const [index, event] of store.events.entries()) {
    assertObject(event, `event line ${index + 1}`);
    assertNonEmptyString(event.id, `event line ${index + 1}`, 'id');
    assertNonEmptyString(event.type, `event line ${index + 1}`, 'type');
    assertNonEmptyString(event.experimentId, `event line ${index + 1}`, 'experimentId');
  }
}

export function bumpRevision(document) {
  document.revision = Number.isInteger(document.revision) ? document.revision + 1 : 1;
  return document;
}

export function migrateDocumentToV2(document) {
  assertObject(document, 'migration document');
  assertSupportedVersion(document.schemaVersion);
  if (document.schemaVersion === CURRENT_SCHEMA_VERSION) {
    return document;
  }
  return {
    ...document,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
  };
}

function assertSupportedVersion(value) {
  if (!supportedVersions.has(value)) {
    throw new Error(`Unsupported schema version ${value ?? '<missing>'}`);
  }
}

function validateRevision(document, label) {
  if (document.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return;
  }
  if (!Number.isInteger(document.revision) || document.revision < 0) {
    throw new Error(`Invalid ${label}: revision must be a non-negative integer`);
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: must be an object`);
  }
}

function assertNonEmptyString(value, label, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid ${label}: ${field} must be a non-empty string`);
  }
}

function assertRecord(value, label) {
  assertObject(value, label);
  assertNonEmptyString(value.id, label, 'id');
}
