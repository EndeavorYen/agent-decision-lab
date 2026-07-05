import { loadCurrentStore } from './store.js';

export async function renderTree(repoPath) {
  const store = await loadCurrentStore(repoPath);
  const lines = [
    `Experiment: ${store.experiment.title}`,
    `ID: ${store.experiment.id}`,
    `Base: ${store.experiment.baseRepository.baseRef} @ ${store.experiment.baseRepository.baseCommit.slice(0, 12)}`,
    '',
    'Decision Tree',
  ];

  const children = new Map();
  for (const node of store.tree.nodes) {
    const parent = node.parentId ?? 'root';
    if (!children.has(parent)) {
      children.set(parent, []);
    }
    children.get(parent).push(node);
  }

  const rootChildren = children.get('root') ?? [];
  if (rootChildren.length === 0) {
    lines.push('- No decision points yet.');
  } else {
    for (const node of rootChildren) {
      renderNode(lines, node, children, 0);
    }
  }

  return `${lines.join('\n')}\n`;
}

function renderNode(lines, node, children, depth) {
  const indent = '  '.repeat(depth);
  if (node.type === 'decision') {
    lines.push(`${indent}- Decision: ${node.title} (${node.id})`);
    if (node.rationale) {
      lines.push(`${indent}  Rationale: ${node.rationale}`);
    }
  } else if (node.type === 'savepoint') {
    lines.push(`${indent}- Savepoint: ${node.title} (${node.id})`);
    if (node.git?.commit) {
      lines.push(`${indent}  Commit: ${node.git.commit.slice(0, 12)}`);
    }
  } else {
    lines.push(`${indent}- Variant: ${node.name} (${node.id})`);
    lines.push(`${indent}  Branch: ${node.branch}`);
    if (node.worktreePath) {
      lines.push(`${indent}  Worktree: ${node.worktreePath}`);
    }
  }

  for (const child of children.get(node.id) ?? []) {
    renderNode(lines, child, children, depth + 1);
  }
}
