import { loadCurrentStore } from './store.js';

export async function renderMermaid(repoPath) {
  const store = await loadCurrentStore(repoPath);
  const lines = ['flowchart TD'];
  const nodeIds = new Set();

  addNode(lines, nodeIds, 'experiment', `Experiment: ${store.experiment.title}`);

  for (const node of store.tree.nodes) {
    if (node.type === 'decision') {
      addDecision(lines, nodeIds, node.id, `Decision: ${node.title}`);
      lines.push(`  experiment --> ${safeId(node.id)}`);
    }
    if (node.type === 'savepoint') {
      addSavepoint(lines, nodeIds, node.id, `Savepoint: ${node.title}`);
      lines.push(`  ${safeId(node.parentId)} --> ${safeId(node.id)}`);
    }
    if (node.type === 'variant') {
      addNode(lines, nodeIds, node.id, `Variant: ${node.name}`);
      lines.push(`  ${safeId(node.parentId)} --> ${safeId(node.id)}`);
    }
  }

  for (const artifact of store.artifacts.artifacts) {
    addNode(lines, nodeIds, artifact.id, `Artifact: ${artifact.id}`);
    if (artifact.variantId) {
      lines.push(`  ${safeId(artifact.variantId)} --> ${safeId(artifact.id)}`);
    }
  }

  for (const evaluation of store.evaluations) {
    addNode(lines, nodeIds, evaluation.id, `Evaluation: ${evaluation.rubricId}`);
    lines.push(`  ${safeId(evaluation.variantId)} --> ${safeId(evaluation.id)}`);
  }

  for (const comparison of store.comparisons) {
    addNode(lines, nodeIds, comparison.id, 'Comparison report');
    for (const variant of comparison.variants) {
      lines.push(`  ${safeId(variant.id)} --> ${safeId(comparison.id)}`);
    }
  }

  const guidance = store.guidanceDrafts.at(-1);
  if (guidance) {
    const comparisonId = guidance.comparisonId;
    addNode(lines, nodeIds, 'guidance_draft', 'Guidance draft');
    lines.push(`  ${safeId(comparisonId)} --> guidance_draft`);
  }

  return `${lines.join('\n')}\n`;
}

function addNode(lines, nodeIds, id, label) {
  const safe = safeId(id);
  if (nodeIds.has(safe)) {
    return;
  }
  nodeIds.add(safe);
  lines.push(`  ${safe}["${escapeLabel(label)}"]`);
}

function addDecision(lines, nodeIds, id, label) {
  const safe = safeId(id);
  if (nodeIds.has(safe)) {
    return;
  }
  nodeIds.add(safe);
  lines.push(`  ${safe}{"${escapeLabel(label)}"}`);
}

function addSavepoint(lines, nodeIds, id, label) {
  const safe = safeId(id);
  if (nodeIds.has(safe)) {
    return;
  }
  nodeIds.add(safe);
  lines.push(`  ${safe}(("${escapeLabel(label)}"))`);
}

function safeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_]/g, '_');
}

function escapeLabel(label) {
  return String(label).replace(/"/g, '\\"');
}
