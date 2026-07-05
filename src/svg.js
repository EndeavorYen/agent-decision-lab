import { redactText } from './redact.js';

export function renderSvg(store, options = {}) {
  const safe = (value) => options.redact === false ? String(value ?? '') : redactText(value);
  const root = {
    id: 'experiment',
    type: 'experiment',
    title: safe(store.experiment.title),
    parentId: null,
  };
  const nodes = [root, ...store.tree.nodes];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map();

  for (const node of store.tree.nodes) {
    const parentId = node.parentId && node.parentId !== 'root' ? node.parentId : 'experiment';
    if (!children.has(parentId)) {
      children.set(parentId, []);
    }
    children.get(parentId).push(node.id);
  }

  const leafOrder = [];
  const positions = new Map();
  assignPositions(root.id, 0);

  const nodeWidth = 260;
  const nodeHeight = 64;
  const columnWidth = 310;
  const rowHeight = 115;
  const marginX = 50;
  const marginY = 80;
  const maxDepth = Math.max(...[...positions.values()].map((position) => position.depth), 0);
  const width = Math.max(900, leafOrder.length * columnWidth + marginX * 2);
  const height = Math.max(620, (maxDepth + 1) * rowHeight + marginY * 2 + 80);

  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    '<title id="title">Agent Decision Lab Experiment Tree</title>',
    `<desc id="desc">${escapeXml(safe(store.experiment.title))} decision tree with savepoints and variants.</desc>`,
    '<defs>',
    '<marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">',
    '<path d="M0,0 L0,6 L9,3 z" fill="#5b6472"/>',
    '</marker>',
    '</defs>',
    '<rect width="100%" height="100%" fill="#f7f8fb"/>',
    `<text x="${marginX}" y="34" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#1f2933">${escapeXml(safe(store.experiment.title))}</text>`,
    `<text x="${marginX}" y="58" font-family="Arial, sans-serif" font-size="13" fill="#53606f">Decisions ${count(store, 'decision')} · Savepoints ${count(store, 'savepoint')} · Variants ${count(store, 'variant')} · Evaluations ${store.evaluations.length} · Comparisons ${store.comparisons.length}</text>`,
  ];

  for (const node of store.tree.nodes) {
    const parentId = node.parentId && node.parentId !== 'root' ? node.parentId : 'experiment';
    drawEdge(lines, absolutePosition(parentId), absolutePosition(node.id));
  }

  for (const node of nodes) {
    drawNode(lines, node, absolutePosition(node.id), { nodeWidth, nodeHeight, store, safe });
  }

  drawLegend(lines, width - 450, height - 54);
  lines.push('</svg>');
  return `${lines.join('\n')}\n`;

  function assignPositions(id, depth) {
    const childIds = children.get(id) ?? [];
    if (childIds.length === 0) {
      const leafIndex = leafOrder.length;
      leafOrder.push(id);
      positions.set(id, { leaf: leafIndex, depth });
      return leafIndex;
    }

    const childLeaves = childIds.map((childId) => assignPositions(childId, depth + 1));
    const leaf = (Math.min(...childLeaves) + Math.max(...childLeaves)) / 2;
    positions.set(id, { leaf, depth });
    return leaf;
  }

  function absolutePosition(id) {
    const position = positions.get(id);
    return {
      x: marginX + position.leaf * columnWidth + columnWidth / 2,
      y: marginY + position.depth * rowHeight,
    };
  }
}

function drawEdge(lines, from, to) {
  lines.push(`<path d="M${from.x},${from.y + 36} C${from.x},${from.y + 72} ${to.x},${to.y - 72} ${to.x},${to.y - 38}" fill="none" stroke="#96a0ad" stroke-width="1.6" marker-end="url(#arrow)"/>`);
}

function drawNode(lines, node, position, options) {
  const { nodeWidth, nodeHeight, store, safe } = options;
  const x = position.x - nodeWidth / 2;
  const y = position.y - nodeHeight / 2;
  const style = nodeStyle(node.type);
  const labels = labelLines(node, store, safe);

  if (node.type === 'decision') {
    const points = [
      `${position.x},${y}`,
      `${x + nodeWidth},${position.y}`,
      `${position.x},${y + nodeHeight}`,
      `${x},${position.y}`,
    ].join(' ');
    lines.push(`<polygon points="${points}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.5"/>`);
  } else if (node.type === 'savepoint') {
    lines.push(`<ellipse cx="${position.x}" cy="${position.y}" rx="${nodeWidth / 2}" ry="${nodeHeight / 2}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.5"/>`);
  } else {
    lines.push(`<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="7" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.5"/>`);
  }

  const firstY = position.y - (labels.length - 1) * 8;
  lines.push(`<text x="${position.x}" y="${firstY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${node.type === 'experiment' ? 14 : 12}" fill="${style.text}">`);
  labels.forEach((label, index) => {
    const weight = index === 0 ? '700' : '400';
    lines.push(`<tspan x="${position.x}" dy="${index === 0 ? 0 : 16}" font-weight="${weight}">${escapeXml(label)}</tspan>`);
  });
  lines.push('</text>');
}

function labelLines(node, store, safe) {
  if (node.type === 'experiment') {
    return wrap(`Experiment: ${safe(node.title)}`, 30);
  }
  if (node.type === 'decision') {
    return wrap(`Decision: ${safe(node.title)}`, 28);
  }
  if (node.type === 'savepoint') {
    const commit = node.git?.commit ? ` @ ${node.git.commit.slice(0, 7)}` : '';
    return wrap(`Savepoint: ${safe(node.title)}${commit}`, 28);
  }
  const evaluation = store.evaluations.find((record) => record.variantId === node.id);
  const artifacts = store.artifacts.artifacts.filter((artifact) => artifact.variantId === node.id);
  const score = evaluation ? scoreLabel(evaluation) : 'no score';
  return [
    ...wrap(`Variant: ${safe(node.name)}`, 28),
    `${score} · artifacts ${artifacts.length}`,
  ];
}

function nodeStyle(type) {
  if (type === 'decision') {
    return { fill: '#fff2cc', stroke: '#c67c00', text: '#4a3410' };
  }
  if (type === 'savepoint') {
    return { fill: '#dff7f2', stroke: '#168574', text: '#123f3a' };
  }
  if (type === 'variant') {
    return { fill: '#e7eefb', stroke: '#3d6fb6', text: '#1f3555' };
  }
  return { fill: '#f1e9ff', stroke: '#7c4dba', text: '#2f2146' };
}

function drawLegend(lines, x, y) {
  const items = [
    ['Decision', '#fff2cc', '#c67c00'],
    ['Savepoint', '#dff7f2', '#168574'],
    ['Variant', '#e7eefb', '#3d6fb6'],
  ];
  lines.push(`<g font-family="Arial, sans-serif" font-size="12" fill="#364152">`);
  items.forEach(([label, fill, stroke], index) => {
    const itemX = x + index * 145;
    lines.push(`<rect x="${itemX}" y="${y}" width="18" height="12" rx="3" fill="${fill}" stroke="${stroke}"/>`);
    lines.push(`<text x="${itemX + 26}" y="${y + 11}">${label}</text>`);
  });
  lines.push('</g>');
}

function count(store, type) {
  return store.tree.nodes.filter((node) => node.type === type).length;
}

function totalScore(evaluation) {
  if (evaluation.noScore || Object.keys(evaluation.scores ?? {}).length === 0) {
    return null;
  }
  return Object.values(evaluation.scores).reduce((sum, score) => sum + score, 0);
}

function scoreLabel(evaluation) {
  const score = totalScore(evaluation);
  return score === null ? 'not scored' : `score ${score}`;
}

function wrap(value, width) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines.slice(0, 3);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
