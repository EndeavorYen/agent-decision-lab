import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { listAdapters, renderAdapterGuide } from './adapters.js';
import { parseArgs } from './args.js';
import { compareVariants } from './compare.js';
import { formatContextReport, inspectContext } from './context.js';
import { formatDoctorReport, runDoctor } from './doctor.js';
import { appendEvent } from './events.js';
import { exportExperiment } from './export.js';
import { draftGuidance } from './guidance.js';
import { exportInsightPack } from './insight.js';
import { formatGuidedLabResult, startGuidedLab } from './lab.js';
import { serveMcp } from './mcp.js';
import { renderOrchestratorGuide } from './orchestrator.js';
import { auditPrivacy, formatPrivacyAudit } from './privacy-audit.js';
import { createRebuildLab } from './rebuild.js';
import { renderTree } from './render.js';
import { createUiServer } from './ui.js';
import {
  createDecision,
  createExperimentStore,
  createSavepoint,
  checkoutSavepoint,
  checkoutVariant,
  findVariant,
  listExperimentStores,
  loadCurrentStore,
  startVariant,
  switchExperimentStore,
  createNewExperimentStore,
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
      case 'whereami':
      case 'context':
        return await whereamiCommand(io, options);
      case 'doctor':
        return await doctorCommand(io, options);
      case 'ui':
        return await uiCommand(io, options);
      case 'lab start':
        return await labStartCommand(io, options, positionals);
      case 'privacy audit':
        return await privacyAuditCommand(io, options);
      case 'insight export':
        return await insightExportCommand(io, options, positionals);
      case 'mcp serve':
        return await mcpServeCommand(io);
      case 'adapter list':
      case 'plugin list':
        return await adapterListCommand(io);
      case 'adapter show':
      case 'plugin show':
        return await adapterShowCommand(io, options, positionals);
      case 'adapter scaffold':
      case 'plugin scaffold':
        return await adapterScaffoldCommand(io, options, positionals);
      case 'experiment create':
        return await experimentCreateCommand(io, options, positionals);
      case 'experiment list':
        return await experimentListCommand(io);
      case 'experiment switch':
        return await experimentSwitchCommand(io, options, positionals);
      case 'case-study init':
        return await caseStudyInitCommand(io, options, positionals);
      case 'case-study add-variant':
        return await caseStudyAddVariantCommand(io, options, positionals);
      case 'case-study record-result':
        return await caseStudyRecordResultCommand(io, options, positionals);
      case 'case-study export':
        return await caseStudyExportCommand(io, options, positionals);
      case 'rebuild init':
        return await rebuildInitCommand(io, options, positionals);
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
      case 'worktree list':
        return await worktreeListCommand(io);
      case 'worktree status':
        return await worktreeStatusCommand(io);
      case 'worktree cleanup':
        return await worktreeCleanupCommand(io, options);
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
      case 'orchestrate':
        return await orchestrateCommand(io, options, positionals);
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

async function whereamiCommand(io, options) {
  const context = await inspectContext(io.cwd);
  if (options.json === true) {
    write(io.stdout, `${JSON.stringify(context, null, 2)}\n`);
  } else {
    write(io.stdout, formatContextReport(context));
  }
  return 0;
}

async function doctorCommand(io, options) {
  const report = await runDoctor(io.cwd);
  if (options.json === true) {
    write(io.stdout, `${JSON.stringify(report, null, 2)}\n`);
  } else {
    write(io.stdout, formatDoctorReport(report));
  }
  return report.ok ? 0 : 1;
}

async function uiCommand(io, options) {
  const ui = await createUiServer(io.cwd, {
    host: options.host ?? '127.0.0.1',
    port: options.port ? Number(options.port) : 8787,
  });
  write(io.stdout, `ADL UI listening at ${ui.url}\n`);
  await new Promise((resolve) => {
    let stopping = false;
    const stop = async () => {
      if (stopping) {
        return;
      }
      stopping = true;
      await ui.close();
      resolve();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
  return 0;
}

async function labStartCommand(io, options, positionals) {
  const title = positionals.join(' ').trim();
  const result = await startGuidedLab(io.cwd, {
    title,
    description: options.description ?? '',
    owner: options.owner ?? null,
    decision: options.decision,
    savepoint: options.savepoint,
    rationale: options.rationale,
    variants: options.variants,
    contextPolicies: options.contextPolicies ?? options.contextPolicy,
    worktree: options.worktree === true,
    labExists: await labExists(io.cwd),
  });
  write(io.stdout, formatGuidedLabResult(result));
  return 0;
}

async function privacyAuditCommand(io, options) {
  const report = await auditPrivacy(io.cwd, {
    path: options.path,
    publicFiles: options.publicFiles === true,
    blocklist: options.blocklist,
  });
  if (options.json === true) {
    write(io.stdout, `${JSON.stringify(report, null, 2)}\n`);
  } else {
    write(io.stdout, formatPrivacyAudit(report));
  }
  return report.status === 'fail' ? 1 : 0;
}

async function insightExportCommand(io, options, positionals) {
  const variants = [
    ...splitOption(options.variants),
    ...positionals,
  ];
  const pack = await exportInsightPack(io.cwd, {
    variants,
    out: options.out,
    includePrivate: options.includePrivate === true,
    redact: options.redact !== false,
  });
  if (options.out) {
    write(io.stdout, `Wrote insight pack to ${options.out}\n`);
  } else {
    write(io.stdout, `${JSON.stringify(pack, null, 2)}\n`);
  }
  return 0;
}

async function mcpServeCommand(io) {
  await serveMcp(io.cwd, io);
  return 0;
}

async function adapterListCommand(io) {
  for (const adapter of listAdapters()) {
    write(io.stdout, `${adapter.id}\t${adapter.summary}\n`);
  }
  return 0;
}

async function adapterShowCommand(io, options, positionals) {
  const id = positionals.join(' ').trim() || options.adapter;
  const guide = renderAdapterGuide(id, { variant: options.variant });
  write(io.stdout, guide);
  return 0;
}

async function adapterScaffoldCommand(io, options, positionals) {
  const id = positionals.join(' ').trim() || options.adapter;
  const guide = renderAdapterGuide(id, { variant: options.variant });
  const out = options.out ?? `.agent-lab/adapters/${id}.md`;
  await writeFileOption(io.cwd, out, guide);
  write(io.stdout, `Scaffolded ${id} adapter to ${out}\n`);
  return 0;
}

async function experimentCreateCommand(io, options, positionals) {
  const title = positionals.join(' ').trim();
  const experiment = await createNewExperimentStore(io.cwd, {
    title,
    description: options.description ?? '',
    owner: options.owner ?? null,
  });
  write(io.stdout, `Created experiment ${experiment.id}\n`);
  return 0;
}

async function experimentListCommand(io) {
  const store = await loadCurrentStore(io.cwd);
  const experiments = await listExperimentStores(io.cwd);
  for (const experiment of experiments) {
    const marker = experiment.id === store.experiment.id ? '*' : ' ';
    write(io.stdout, `${marker} ${experiment.id} ${experiment.title}\n`);
  }
  return 0;
}

async function experimentSwitchCommand(io, options, positionals) {
  const value = positionals.join(' ').trim() || options.experiment;
  const experiment = await switchExperimentStore(io.cwd, value);
  write(io.stdout, `Switched experiment ${experiment.id}\n`);
  return 0;
}

async function caseStudyInitCommand(io, options, positionals) {
  const title = positionals.join(' ').trim();
  const create = await labExists(io.cwd) ? createNewExperimentStore : createExperimentStore;
  const experiment = await create(io.cwd, {
    title,
    description: options.description ?? '',
    owner: options.owner ?? null,
  });
  const decision = await createDecision(io.cwd, {
    title: options.decision ?? 'Agent collaboration strategy',
    rationale: options.rationale ?? '',
  });
  const savepoint = await createSavepoint(io.cwd, {
    title: options.savepoint ?? 'Before case-study task',
    decision: decision.id,
  });

  write(io.stdout, [
    `Created case study ${experiment.id}`,
    `Decision: ${decision.id}`,
    `Savepoint: ${savepoint.id}`,
    '',
  ].join('\n'));
  return 0;
}

async function caseStudyAddVariantCommand(io, options, positionals) {
  const name = positionals.join(' ').trim();
  const variant = await startVariant(io.cwd, {
    name,
    from: options.from,
    branch: options.branch,
    worktreePath: options.worktreePath,
    createBranch: true,
    createWorktree: options.worktree === true,
    attach: options.attach === true,
    promptSummary: options.promptSummary ?? '',
  });
  const strategy = await setStrategy(io.cwd, {
    variant: variant.id,
    from: options.from ?? variant.savepointId,
    contextPolicy: options.contextPolicy ?? 'unspecified',
    promptPolicy: options.promptPolicy,
    hypothesis: options.hypothesis,
    risks: splitOption(options.risk ?? options.risks),
    visibleContext: splitOption(options.visibleContext ?? options.visible),
    withheldContext: splitOption(options.withheldContext ?? options.withheld),
    controls: splitOption(options.controls),
  });

  write(io.stdout, [
    `Added case-study variant ${variant.id}`,
    `Branch: ${variant.branch}`,
    variant.worktreePath ? `Worktree: ${variant.worktreePath}` : null,
    `Strategy: ${strategy.id}`,
    '',
  ].filter(Boolean).join('\n'));
  return 0;
}

async function caseStudyRecordResultCommand(io, options, positionals) {
  const variant = positionals.join(' ').trim() || options.variant;
  const artifacts = splitOption(options.artifact ?? options.artifacts);
  for (let index = 0; index < artifacts.length; index += 1) {
    const path = artifacts[index];
    await addArtifact(io.cwd, {
      id: options.artifactId ?? `artifact-${slugForOutput(variant)}-${index + 1}`,
      variant,
      path,
      classification: options.classification ?? 'private',
      visibleToAgent: options.visibleToAgent === true,
      summary: options.summary ?? '',
    });
  }

  const evaluation = await evaluateVariant(io.cwd, {
    variant,
    rubric: options.rubric ?? 'code-review-rule-quality',
    reviewer: options.reviewer ?? 'human',
    noScore: isNoScore(options),
    scores: parseScores(options.scores ?? (options.score === false ? undefined : options.score)),
    strengths: splitOption(options.strengths),
    weaknesses: splitOption(options.weaknesses),
    evidence: splitOption(options.evidence),
  });

  write(io.stdout, [
    `Recorded case-study result for ${variant}`,
    artifacts.length > 0 ? `Artifacts: ${artifacts.length}` : 'Artifacts: 0',
    `Evaluation: ${evaluation.id}`,
    '',
  ].join('\n'));
  return 0;
}

async function caseStudyExportCommand(io, options, positionals) {
  const store = await loadCurrentStore(io.cwd);
  const variants = positionals.length > 0 ? positionals : store.variants.map((variant) => variant.name);
  if (variants.length < 2) {
    throw new Error('At least two variants are required for a case-study export');
  }
  const outDir = options.outDir ?? `.agent-lab/experiments/${store.experiment.id}/exports/case-study`;
  const comparison = await compareVariants(io.cwd, {
    variants,
    rubric: options.rubric ?? 'code-review-rule-quality',
  });
  await writeFileOption(io.cwd, `${outDir}/comparison.md`, comparison.markdown);
  const guidance = await draftGuidance(io.cwd, { comparison: comparison.id });
  await writeFileOption(io.cwd, `${outDir}/guidance.md`, guidance);
  await exportExperiment(io.cwd, { format: 'svg', out: `${outDir}/tree.svg` });
  await exportExperiment(io.cwd, { format: 'html', out: `${outDir}/report.html` });
  await exportExperiment(io.cwd, { format: 'markdown', out: `${outDir}/report.md` });
  await exportExperiment(io.cwd, { format: 'json', out: `${outDir}/export.json` });

  write(io.stdout, `Wrote case-study exports to ${outDir}\n`);
  return 0;
}

async function rebuildInitCommand(io, options, positionals) {
  const title = positionals.join(' ').trim();
  const result = await createRebuildLab(io.cwd, {
    title,
    base: options.base,
    baseWorktree: options.baseWorktree,
    branch: options.branch,
    keep: splitOption(options.keep),
    decision: options.decision,
    savepoint: options.savepoint,
    rationale: options.rationale,
    variants: splitOption(options.variants),
    worktree: options.worktree === true,
  });
  write(io.stdout, [
    `Created rebuild lab`,
    `Base lab: ${result.baseWorktree}`,
    `Savepoint: ${result.savepoint.id}`,
    `Variant worktrees:`,
    ...result.variants.map((variant) => `- ${variant.name}: ${variant.worktreePath ?? variant.branch}`),
    `Metadata commands: run ADL from ${result.baseWorktree}`,
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

async function worktreeListCommand(io) {
  const store = await loadCurrentStore(io.cwd);
  const worktrees = await worktreeRecords(store);
  if (worktrees.length === 0) {
    write(io.stdout, 'No ADL worktrees recorded.\n');
    return 0;
  }
  for (const record of worktrees) {
    write(io.stdout, `${record.state} ${record.variant.name} ${record.variant.branch} ${record.path}\n`);
  }
  return 0;
}

async function worktreeStatusCommand(io) {
  const store = await loadCurrentStore(io.cwd);
  const worktrees = await worktreeRecords(store);
  const missing = worktrees.filter((record) => record.state === 'missing');
  write(io.stdout, [
    `Registered worktrees: ${worktrees.length}`,
    `Missing worktrees: ${missing.length}`,
    '',
  ].join('\n'));
  return 0;
}

async function worktreeCleanupCommand(io, options) {
  const store = await loadCurrentStore(io.cwd);
  const worktrees = await worktreeRecords(store);
  if (options.dryRun !== true) {
    throw new Error('worktree cleanup currently requires --dry-run');
  }
  if (worktrees.length === 0) {
    write(io.stdout, 'No ADL worktrees recorded.\n');
    return 0;
  }
  for (const record of worktrees) {
    write(io.stdout, `Would remove ${record.variant.name} ${record.path} (${record.state})\n`);
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
    noScore: isNoScore(options),
    scores: parseScores(options.scores ?? (options.score === false ? undefined : options.score)),
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

async function orchestrateCommand(io, options, positionals) {
  const store = await loadCurrentStore(io.cwd);
  const variantName = positionals.join(' ').trim() || options.variant;
  const variant = variantName ? findVariant(store, variantName) : null;
  if (variantName && !variant) {
    throw new Error(`Variant not found: ${variantName}`);
  }
  if (options.response) {
    const responseEvent = await appendEvent(io.cwd, {
      type: 'response',
      body: options.response,
      variantId: variant?.id,
      actor: options.actor ?? 'agent',
    });
    write(io.stdout, `Recorded response ${responseEvent.id}\n`);
  }
  if (options.note) {
    const noteEvent = await appendEvent(io.cwd, {
      type: 'note',
      body: options.note,
      variantId: variant?.id,
      actor: options.actor ?? 'human',
    });
    write(io.stdout, `Recorded note ${noteEvent.id}\n`);
  }
  if (options.checkpoint) {
    const checkpoint = await appendEvent(io.cwd, {
      type: 'checkpoint',
      body: options.checkpoint,
      variantId: variant?.id,
      actor: options.actor ?? 'human',
    });
    write(io.stdout, `Recorded checkpoint ${checkpoint.id}\n`);
  }
  write(io.stdout, renderOrchestratorGuide(store, { variant: variantName }));
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
    metadata: parseMetadata(options.metadata),
  });
  write(io.stdout, `Logged ${event.type} ${event.id}\n`);
  return 0;
}

async function runCommand(io, options, positionals) {
  if (positionals.length === 0) {
    throw new Error('Command is required after --');
  }
  const variantId = options.variant ? await resolveVariantId(io.cwd, options.variant) : undefined;
  const started = Date.now();
  const result = spawnSync(positionals[0], positionals.slice(1), {
    cwd: io.cwd,
    encoding: 'utf8',
  });
  const durationMs = Date.now() - started;
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
      durationMs,
      stdoutBytes: byteLength(result.stdout),
      stderrBytes: byteLength(result.stderr),
      error: result.error ? {
        name: result.error.name,
        code: result.error.code,
        message: result.error.message,
      } : null,
    },
  });
  const quiet = options.quiet === true;
  const tail = parseTail(options.tail);
  if (!quiet && tail !== null) {
    writeTail(io.stdout, result.stdout, tail);
    writeTail(io.stderr, result.stderr, tail);
  } else if (!quiet && result.stdout) {
    write(io.stdout, result.stdout);
  }
  if (!quiet && tail === null && result.stderr) {
    write(io.stderr, result.stderr);
  }
  if (quiet && exitCode !== 0) {
    write(io.stdout, `Command failed exit ${exitCode}\n`);
  }
  write(io.stdout, `Recorded command ${event.id} exit ${exitCode}\n`);
  return exitCode;
}

async function checkpointCommand(io, options, positionals) {
  const body = await eventBody(io, options, positionals);
  const variantId = options.variant ? await resolveVariantId(io.cwd, options.variant) : undefined;
  const event = await appendEvent(io.cwd, {
    type: 'checkpoint',
    body,
    variantId,
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
  adl doctor [--json]
  adl whereami [--json]
  adl lab start "Strategy Lab" --variants docs-visible,prompt-only [--worktree]
  adl privacy audit [--path .agent-lab/exports] [--public-files] [--json]
  adl insight export --variants a,b --out .agent-lab/exports/insight-pack.json
  adl mcp serve
  adl ui [--host 127.0.0.1] [--port 8787]
  adl adapter list
  adl adapter show manual
  adl adapter scaffold manual --out .agent-lab/adapters/manual.md
  adl plugin scaffold command-wrapper --variant variant-name
  adl status
  adl experiment create "Experiment Title"
  adl experiment list
  adl experiment switch experiment-title-or-id
  adl case-study init "Case Study Title" --decision "..." --savepoint "..."
  adl case-study add-variant variant-name --from savepoint-title-or-id [--worktree]
  adl case-study record-result variant-name --artifact path --strengths "..." --weaknesses "..." --evidence "..." [--no-score]
  adl case-study export variant-a variant-b [variant-c] --out-dir .agent-lab/exports/case
  adl rebuild init "Blank Rebuild" --keep AGENTS.md --variants docs-visible,prompt-only --worktree
  adl orchestrate [variant-name] [--response "..."] [--checkpoint "..."]
  adl decision create "Decision Title" --rationale "Why this fork matters" [--parent node-id]
  adl savepoint create "Read project guidance?" --decision decision-title-or-id
  adl variant start variant-name --from savepoint-title-or-id [--worktree]
  adl variant checkout variant-name
  adl worktree list
  adl worktree status
  adl worktree cleanup --dry-run
  adl savepoint checkout savepoint-title-or-id [--branch branch-name]
  adl template context-ab --question "..." --decision "..." --a guidance-visible --b prompt-only [--c draft-then-compare]
  adl strategy set variant-name --from savepoint-title-or-id --context-policy policy
  adl artifact add artifact-id --variant variant-name --path path
  adl evaluate variant-name --scores '{"alignment":5}' [--no-score]
  adl compare variant-a variant-b [variant-c] --out comparison.md
  adl guidance draft --comparison comparison-id --out guidance.md
  adl log prompt|response|note|command|artifact [text] [--stdin] [--variant variant-name]
  adl checkpoint "Checkpoint name" [--variant variant-name]
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

function parseTail(value) {
  if (value === undefined || value === false) {
    return null;
  }
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('--tail must be a non-negative integer');
  }
  return count;
}

function writeTail(stream, value, count) {
  if (!value || count === 0) {
    return;
  }
  const lines = value.trimEnd().split('\n').slice(-count);
  if (lines.length > 0 && lines[0] !== '') {
    write(stream, `${lines.join('\n')}\n`);
  }
}

function byteLength(value) {
  return Buffer.byteLength(value ?? '', 'utf8');
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

async function labExists(repoPath) {
  return await pathExists(`${repoPath}/.agent-lab/config.json`);
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function worktreeRecords(store) {
  const records = [];
  for (const variant of store.variants.filter((record) => record.worktreePath)) {
    const exists = await pathExists(variant.worktreePath);
    records.push({
      variant,
      path: variant.worktreePath,
      state: exists ? 'registered' : 'missing',
    });
  }
  return records;
}

function isNoScore(options) {
  return options.noScore === true || options.score === false;
}

function slugForOutput(value) {
  return String(value ?? 'variant')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'variant';
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

function parseMetadata(value) {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value;
  }
  return JSON.parse(String(value));
}
