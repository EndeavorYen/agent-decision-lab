import { readFile } from 'node:fs/promises';
import { parseArgs } from './args.js';
import { appendEvent } from './events.js';
import { exportExperiment } from './export.js';
import { renderTree } from './render.js';
import { createDecision, createExperimentStore, loadCurrentStore, startVariant } from './store.js';

export async function runCli(argv, io) {
  const { command, options, positionals } = parseArgs(argv);

  try {
    if (options.help || command.length === 0 || command[0] === 'help') {
      write(io.stdout, helpText());
      return 0;
    }

    const name = command.join(' ');
    switch (name) {
      case 'init':
        return await initCommand(io, options, positionals);
      case 'status':
        return await statusCommand(io);
      case 'decision create':
        return await decisionCreateCommand(io, options, positionals);
      case 'variant start':
        return await variantStartCommand(io, options, positionals);
      case 'log prompt':
      case 'log response':
      case 'log note':
      case 'log command':
      case 'log artifact':
        return await logCommand(io, command[1], options, positionals);
      case 'checkpoint':
        return await checkpointCommand(io, options, positionals);
      case 'tree':
        write(io.stdout, await renderTree(io.cwd));
        return 0;
      case 'export':
        return await exportCommand(io, options);
      default:
        throw new Error(`Unknown command: ${name}`);
    }
  } catch (error) {
    write(io.stderr, `Error: ${error.message}\n`);
    return 1;
  }
}

async function initCommand(io, options, positionals) {
  const title = positionals.join(' ').trim();
  const experiment = await createExperimentStore(io.cwd, {
    title,
    description: options.description ?? '',
    owner: options.owner ?? null,
  });
  write(io.stdout, `Initialized experiment ${experiment.id}\n`);
  return 0;
}

async function statusCommand(io) {
  const store = await loadCurrentStore(io.cwd);
  const active = store.variants.find((variant) => variant.id === store.config.activeVariantId);
  write(io.stdout, [
    `Experiment: ${store.experiment.title}`,
    `ID: ${store.experiment.id}`,
    `Active variant: ${active ? `${active.name} (${active.id})` : 'none'}`,
    `Decisions: ${store.tree.nodes.filter((node) => node.type === 'decision').length}`,
    `Variants: ${store.variants.length}`,
    `Events: ${store.events.length}`,
    '',
  ].join('\n'));
  return 0;
}

async function decisionCreateCommand(io, options, positionals) {
  const title = positionals.join(' ').trim();
  const decision = await createDecision(io.cwd, {
    title,
    rationale: options.rationale ?? '',
    parentId: options.parent ?? undefined,
  });
  write(io.stdout, `Created decision ${decision.id}\n`);
  return 0;
}

async function variantStartCommand(io, options, positionals) {
  const name = positionals.join(' ').trim();
  const variant = await startVariant(io.cwd, {
    name,
    decision: options.decision,
    branch: options.branch,
    worktreePath: options.worktreePath,
    createBranch: true,
    createWorktree: options.worktree === true,
    attach: options.attach === true,
    promptSummary: options.promptSummary ?? '',
  });
  write(io.stdout, `Started variant ${variant.id} on ${variant.branch}\n`);
  if (variant.worktreePath) {
    write(io.stdout, `Worktree: ${variant.worktreePath}\n`);
  }
  return 0;
}

async function logCommand(io, type, options, positionals) {
  const body = await eventBody(io, options, positionals);
  const event = await appendEvent(io.cwd, {
    type,
    body,
    actor: options.actor ?? 'human',
  });
  write(io.stdout, `Logged ${event.type} ${event.id}\n`);
  return 0;
}

async function checkpointCommand(io, options, positionals) {
  const body = await eventBody(io, options, positionals);
  const event = await appendEvent(io.cwd, {
    type: 'checkpoint',
    body,
    actor: options.actor ?? 'human',
  });
  write(io.stdout, `Created checkpoint ${event.id}\n`);
  return 0;
}

async function exportCommand(io, options) {
  const format = options.format ?? 'json';
  const includePrivate = options.includePrivate === true;
  const redact = options.redact !== false;
  const result = await exportExperiment(io.cwd, {
    format,
    out: options.out,
    includePrivate,
    redact,
  });

  if (options.out) {
    write(io.stdout, `Exported ${format} to ${options.out}\n`);
  } else if (format === 'json') {
    write(io.stdout, `${JSON.stringify(result, null, 2)}\n`);
  } else {
    write(io.stdout, result);
  }
  return 0;
}

async function eventBody(io, options, positionals) {
  if (options.stdin) {
    return await readStream(io.stdin);
  }
  const fromFile = options.file ? await readFile(options.file, 'utf8') : '';
  const body = positionals.join(' ').trim() || fromFile.trimEnd();
  if (!body) {
    throw new Error('Event body is required; pass text, --stdin, or --file');
  }
  return body;
}

async function readStream(stream) {
  let body = '';
  for await (const chunk of stream) {
    body += chunk;
  }
  return body.trimEnd();
}

function helpText() {
  return `Agent Decision Lab (adl)

Usage:
  adl init "Experiment Title"
  adl status
  adl decision create "Decision Title" --rationale "Why this fork matters"
  adl variant start variant-name --decision decision-title-or-id [--worktree]
  adl log prompt|response|note|command|artifact [text] [--stdin]
  adl checkpoint "Checkpoint name"
  adl tree
  adl export --format json|markdown [--out path] [--include-private] [--no-redact]

`;
}

function write(stream, value) {
  stream.write(value);
}
