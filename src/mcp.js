import { appendEvent } from './events.js';
import { formatContextReport, inspectContext } from './context.js';
import { formatDoctorReport, runDoctor } from './doctor.js';
import { exportExperiment } from './export.js';
import { renderOrchestratorGuide } from './orchestrator.js';
import { renderTree } from './render.js';
import { findVariant, loadCurrentStore } from './store.js';

const toolDefinitions = [
  ['doctor', 'Return local Git, Node, lab, privacy, and dirty-tree readiness.'],
  ['status', 'Return current experiment and route summary without private bodies.'],
  ['whereami', 'Return current checkout role, branch, lab, and variant context.'],
  ['tree', 'Return the human-readable decision tree.'],
  ['orchestrate', 'Return the prompt block for a variant route.'],
  ['log_prompt', 'Record a prompt event.'],
  ['log_response', 'Record an agent response event.'],
  ['log_note', 'Record a note event.'],
  ['checkpoint', 'Record a checkpoint event.'],
  ['record_command', 'Record supplied command output metadata; does not execute shell commands.'],
  ['export_summary', 'Create a redacted summary export pack.'],
];

export async function serveMcp(repoPath, io) {
  let buffer = '';
  for await (const chunk of io.stdin) {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        await handleJsonRpcLine(repoPath, io, line);
      }
      newline = buffer.indexOf('\n');
    }
  }
}

async function handleJsonRpcLine(repoPath, io, line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch (error) {
    writeResponse(io, null, null, { code: -32700, message: `Parse error: ${error.message}` });
    return;
  }
  try {
    const result = await handleRequest(repoPath, request);
    if (request.id !== undefined) {
      writeResponse(io, request.id, result);
    }
  } catch (error) {
    writeResponse(io, request.id ?? null, null, { code: -32000, message: error.message });
  }
}

async function handleRequest(repoPath, request) {
  switch (request.method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'agent-decision-lab', version: '0.1.0' },
        capabilities: { tools: {} },
      };
    case 'tools/list':
      return {
        tools: toolDefinitions.map(([name, description]) => ({
          name,
          description,
          inputSchema: { type: 'object', properties: {}, additionalProperties: true },
        })),
      };
    case 'tools/call':
      return await callTool(repoPath, request.params?.name, request.params?.arguments ?? {});
    default:
      throw new Error(`Unsupported MCP method: ${request.method}`);
  }
}

async function callTool(repoPath, name, args) {
  switch (name) {
    case 'doctor':
      return textResult(formatDoctorReport(await runDoctor(repoPath)));
    case 'status':
      return textResult(formatStatus(await loadCurrentStore(repoPath)));
    case 'whereami':
      return textResult(formatContextReport(await inspectContext(repoPath)));
    case 'tree':
      return textResult(await renderTree(repoPath));
    case 'orchestrate': {
      const store = await loadCurrentStore(repoPath);
      return textResult(renderOrchestratorGuide(store, { variant: args.variant }));
    }
    case 'log_prompt':
      return await eventTool(repoPath, 'prompt', args, 'human');
    case 'log_response':
      return await eventTool(repoPath, 'response', args, 'agent');
    case 'log_note':
      return await eventTool(repoPath, 'note', args, 'human');
    case 'checkpoint':
      return await eventTool(repoPath, 'checkpoint', args, 'human');
    case 'record_command':
      return await eventTool(repoPath, 'command', {
        ...args,
        body: args.body ?? renderCommandBody(args),
        metadata: {
          command: args.command ?? null,
          status: args.status ?? args.exitCode ?? null,
          stdoutBytes: args.stdoutBytes ?? null,
          stderrBytes: args.stderrBytes ?? null,
          durationMs: args.durationMs ?? null,
        },
      }, 'agent');
    case 'export_summary': {
      const out = args.out ?? '.agent-lab/exports/mcp-summary.json';
      await exportExperiment(repoPath, { format: 'json', out, includePrivate: false, redact: true });
      return textResult(`Exported redacted summary to ${out}`);
    }
    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

async function eventTool(repoPath, type, args, defaultActor) {
  const store = await loadCurrentStore(repoPath);
  const variant = args.variant ? findVariant(store, args.variant) : null;
  if (args.variant && !variant) {
    throw new Error(`Variant not found: ${args.variant}`);
  }
  const event = await appendEvent(repoPath, {
    type,
    body: args.body ?? '',
    variantId: variant?.id,
    actor: args.actor ?? defaultActor,
    metadata: args.metadata ?? {},
  });
  return textResult(`Recorded ${type} event ${event.id}`);
}

function formatStatus(store) {
  const active = findVariant(store, store.config.activeVariantId);
  return [
    `Experiment: ${store.experiment.title}`,
    `ID: ${store.experiment.id}`,
    `Active variant: ${active ? active.name : 'none'}`,
    `Variants: ${store.variants.length}`,
    `Events: ${store.events.length}`,
    '',
  ].join('\n');
}

function renderCommandBody(args) {
  return [
    args.command ? `$ ${Array.isArray(args.command) ? args.command.join(' ') : args.command}` : '$ <recorded command>',
    `exit: ${args.status ?? args.exitCode ?? 'unknown'}`,
    args.summary ?? '',
  ].join('\n');
}

function textResult(text) {
  return {
    content: [
      { type: 'text', text },
    ],
  };
}

function writeResponse(io, id, result, error = null) {
  io.stdout.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id,
    ...(error ? { error } : { result }),
  })}\n`);
}
