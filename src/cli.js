import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { parseArgs } from './args.js';
import { compareVariants } from './compare.js';
import { appendEvent } from './events.js';
import { exportExperiment } from './export.js';
import { draftGuidance } from './guidance.js';
import { renderTree } from './render.js';
import {
  createDecision,
  createExperimentStore,
  createSavepoint,
  checkoutSavepoint,
  checkoutVariant,
  findVariant,
  loadCurrentStore,
  startVariant,
} from './store.js';
import { addArtifact, evaluateVariant, setStrategy } from './strategy.js';
import { createContextAbTemplate } from './templates.js';

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
      case 'savepoint create':
        return await savepointCreateCommand(io, options, positionals);
      case 'savepoint checkout':
        return await savepointCheckoutCommand(io, options, positionals);
      case 'variant start':
        return await variantStartCommand(io, options, positionals);
      case 'variant checkout':
        return await variantCheckoutCommand(io, options, positionals);
      case 'strategy set':
        return await strategySetCommand(io, options, positionals);
      case 'artifact add':
        return await artifactAddCommand(io, options, positionals);
      case 'template context-ab':
        return await templateContextAbCommand(io, options);
      case 'evaluate':
        return await evaluateCommand(io, options, positionals);
      case 'compare':
        return await compareCommand(io, options, positionals);
      case 'guidance draft':
        return await guidanceDraftCommand(io, options);
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
      case 'run':
        return await runCommand(io, options, positionals);
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
    `Savepoints: ${store.savepoints.length}`,
    `Variants: ${store.variants.length}`,
    `Strategies: ${store.strategies.length}`,
    `Evaluations: ${store.evaluations.length}`,
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
    parentId: options.parent ?? options.parentId ?? undefined,
  });
  write(io.stdout, `Created decision ${decision.id}\n`);
  return 0;
}

async function savepointCreateCommand(io, options, positionals) {
  const title = positionals.join(' ').trim();
  const savepoint = await createSavepoint(io.cwd, {
    title,
    decision: options.decision,
    rationale: options.rationale ?? '',
    contextPolicy: options.contextPolicy,
  });
  write(io.stdout, `Created savepoint ${savepoint.id} at ${savepoint.git.commit.slice(0, 12)}\n`);
  return 0;
}

async function variantStartCommand(io, options, positionals) {
  const name = positionals.join(' ').trim();
  const variant = await startVariant(io.cwd, {
    name,
    decision: options.decision,
    from: options.from,
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

async function variantCheckoutCommand(io, options, positionals) {
  const name = positionals.join(' ').trim() || options.variant;
  const variant = await checkoutVariant(io.cwd, {
    variant: name,
    force: options.force === true,
  });
  if (variant.worktreePath) {
    write(io.stdout, `Active variant ${variant.id}; use worktree ${variant.worktreePath}\n`);
  } else {
    write(io.stdout, `Checked out variant ${variant.id} on ${variant.branch}\n`);
  }
  return 0;
}

async function savepointCheckoutCommand(io, options, positionals) {
  const name = positionals.join(' ').trim() || options.savepoint;
  const result = await checkoutSavepoint(io.cwd, {
    savepoint: name,
    branch: options.branch,
    force: options.force === true,
  });
  write(io.stdout, `Checked out savepoint ${result.savepoint.id} on ${result.branch}\n`);
  return 0;
}

async function strategySetCommand(io, options, positionals) {
  const variantName = positionals.join(' ').trim();
  const strategy = await setStrategy(io.cwd, {
    variant: variantName,
    from: options.from,
    contextPolicy: options.contextPolicy,
    promptPolicy: options.promptPolicy,
    hypothesis: options.hypothesis,
    risks: splitOption(options.risk ?? options.risks),
    visibleContext: splitOption(options.visibleContext ?? options.visible),
    withheldContext: splitOption(options.withheldContext ?? options.withheld),
    controls: splitOption(options.controls),
  });
  write(io.stdout, `Recorded strategy ${strategy.id}\n`);
  return 0;
}

async function artifactAddCommand(io, options, positionals) {
  const id = positionals.join(' ').trim() || options.id;
  const artifact = await addArtifact(io.cwd, {
    id,
    variant: options.variant,
    path: options.path,
    classification: options.classification ?? 'private',
    visibleToAgent: options.visibleToAgent === true,
    summary: options.summary ?? '',
  });
  write(io.stdout, `Recorded artifact ${artifact.id}\n`);
  return 0;
}

async function templateContextAbCommand(io, options) {
  const result = await createContextAbTemplate(io.cwd, {
    question: options.question,
    decision: options.decision,
    a: options.a,
    b: options.b,
    c: options.c,
  });
  write(io.stdout, [
    `Created context-ab template`,
    `Decision: ${result.decision.id}`,
    `Savepoint: ${result.savepoint.id}`,
    `Variants: ${result.variants.map((variant) => variant.name).join(', ')}`,
    '',
  ].join('\n'));
  return 0;
}

async function evaluateCommand(io, options, positionals) {
  const variant = positionals.join(' ').trim() || options.variant;
  const evaluation = await evaluateVariant(io.cwd, {
    variant,
    rubric: options.rubric ?? 'code-review-rule-quality',
    reviewer: options.reviewer ?? 'human',
    scores: parseScores(options.scores ?? options.score),
    strengths: splitOption(options.strengths),
    weaknesses: splitOption(options.weaknesses),
    evidence: splitOption(options.evidence),
  });
  write(io.stdout, `Recorded evaluation ${evaluation.id}\n`);
  return 0;
}

async function compareCommand(io, options, positionals) {
  const comparison = await compareVariants(io.cwd, {
    variants: positionals,
    rubric: options.rubric ?? 'code-review-rule-quality',
  });
  if (options.out) {
    await writeFileOption(io.cwd, options.out, comparison.markdown);
    write(io.stdout, `Wrote comparison ${comparison.id} to ${options.out}\n`);
  } else {
    write(io.stdout, comparison.markdown);
  }
  return 0;
}

async function guidanceDraftCommand(io, options) {
  const guidance = await draftGuidance(io.cwd, {
    comparison: options.comparison,
  });
  if (options.out) {
    await writeFileOption(io.cwd, options.out, guidance);
    write(io.stdout, `Wrote guidance draft to ${options.out}\n`);
  } else {
    write(io.stdout, guidance);
  }
  return 0;
}

async function logCommand(io, type, options, positionals) {
  const body = await eventBody(io, options, positionals);
  const variantId = options.variant ? await resolveVariantId(io.cwd, options.variant) : undefined;
  const event = await appendEvent(io.cwd, {
    type,
    body,
    variantId,
    actor: options.actor ?? 'human',
  });
  write(io.stdout, `Logged ${event.type} ${event.id}\n`);
  return 0;
}

async function runCommand(io, options, positionals) {
  if (positionals.length === 0) {
    throw new Error('Command is required after --');
  }
  const variantId = options.variant ? await resolveVariantId(io.cwd, options.variant) : undefined;
  const result = spawnSync(positionals[0], positionals.slice(1), {
    cwd: io.cwd,
    encoding: 'utf8',
  });
  const exitCode = result.status ?? 1;
  const event = await appendEvent(io.cwd, {
    type: 'command',
    body: renderCommandEventBody(positionals, result, exitCode),
    variantId,
    actor: options.actor ?? 'agent',
    metadata: {
      command: positionals,
      exitCode,
      signal: result.signal ?? null,
      error: result.error ? {
        name: result.error.name,
        code: result.error.code,
        message: result.error.message,
      } : null,
    },
  });
  if (result.stdout) {
    write(io.stdout, result.stdout);
  }
  if (result.stderr) {
    write(io.stderr, result.stderr);
  }
  write(io.stdout, `Recorded command ${event.id} exit ${exitCode}\n`);
  return exitCode;
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

async function resolveVariantId(repoPath, value) {
  const store = await loadCurrentStore(repoPath);
  const variant = findVariant(store, value);
  if (!variant) {
    throw new Error(`Variant not found: ${value}`);
  }
  return variant.id;
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
  adl decision create "Decision Title" --rationale "Why this fork matters" [--parent node-id]
  adl savepoint create "Read project guidance?" --decision decision-title-or-id
  adl variant start variant-name --from savepoint-title-or-id [--worktree]
  adl variant checkout variant-name
  adl savepoint checkout savepoint-title-or-id [--branch branch-name]
  adl template context-ab --question "..." --decision "..." --a guidance-visible --b prompt-only [--c draft-then-compare]
  adl strategy set variant-name --from savepoint-title-or-id --context-policy policy
  adl artifact add artifact-id --variant variant-name --path path
  adl evaluate variant-name --scores '{"alignment":5}'
  adl compare variant-a variant-b [variant-c] --out comparison.md
  adl guidance draft --comparison comparison-id --out guidance.md
  adl log prompt|response|note|command|artifact [text] [--stdin] [--variant variant-name]
  adl checkpoint "Checkpoint name"
  adl tree
  adl run [--variant variant-name] -- command args...
  adl export --format json|markdown|mermaid|svg|html [--out path] [--include-private] [--no-redact]

`;
}

function renderCommandEventBody(command, result, exitCode) {
  return [
    `$ ${quoteCommand(command)}`,
    `exit: ${exitCode}`,
    result.error ? `spawn error: ${result.error.message}` : null,
    '',
    'stdout:',
    result.stdout?.trimEnd() ?? '',
    '',
    'stderr:',
    result.stderr?.trimEnd() ?? '',
  ].filter((line) => line !== null).join('\n');
}

function quoteCommand(command) {
  return command.map((part) => (
    /[\s"']/.test(part) ? JSON.stringify(part) : part
  )).join(' ');
}

function write(stream, value) {
  stream.write(value);
}

async function writeFileOption(repoPath, out, body) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');
  const outputPath = resolve(repoPath, out);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, body);
}

function splitOption(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(splitOption);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseScores(value) {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value;
  }
  const text = String(value);
  if (text.trim().startsWith('{')) {
    return JSON.parse(text);
  }
  return Object.fromEntries(
    text.split(',').map((pair) => {
      const [key, rawValue] = pair.split('=');
      return [key.trim(), Number(rawValue)];
    }),
  );
}
