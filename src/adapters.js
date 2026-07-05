const adapters = [
  {
    id: 'manual',
    aliases: ['manual-agent', 'human-in-loop'],
    name: 'Manual Agent Adapter',
    summary: 'Provider-neutral recipe for logging prompts, responses, commands, and artifacts by hand.',
    bestFor: [
      'first production case study',
      'mixed human and agent review',
      'private targets where raw transcripts stay local',
    ],
    commands: [
      'adl log prompt --variant <variant> --stdin',
      'adl log response --variant <variant> --stdin',
      'adl run --variant <variant> -- <test-command>',
      'adl artifact add <artifact-id> --variant <variant> --path <path>',
      'adl case-study record-result <variant> --artifact <path> --no-score',
    ],
    guardrails: [
      'Store raw prompts and transcripts only in the target workspace.',
      'Export with redaction enabled before sharing results.',
      'Use --include-private only for local review.',
    ],
  },
  {
    id: 'command-wrapper',
    aliases: ['command', 'shell'],
    name: 'Command Wrapper Adapter',
    summary: 'Provider-neutral recipe for wrapping agent, test, or review commands through adl run.',
    bestFor: [
      'agent CLIs that already run locally',
      'test and release gates',
      'repeatable command evidence',
    ],
    commands: [
      'adl run --variant <variant> -- <agent-or-test-command>',
      'adl log note --variant <variant> "Why this command was run"',
      'adl case-study record-result <variant> --evidence "recorded command exit code" --no-score',
    ],
    guardrails: [
      'Review commands before running them.',
      'Do not let model output execute without human approval.',
      'Record failed commands as evidence instead of hiding them.',
    ],
  },
  {
    id: 'codex-session',
    aliases: ['codex'],
    name: 'Codex Session Recipe',
    summary: 'Provider-neutral recipe for using Codex as the human-operated agent while ADL records evidence.',
    bestFor: [
      'Codex desktop or CLI workflows',
      'multi-worktree implementation comparisons',
      'prompt strategy experiments',
    ],
    commands: [
      'adl case-study add-variant <variant> --from <savepoint> --worktree',
      'adl log prompt --variant <variant> --stdin',
      'adl run --variant <variant> -- <verification-command>',
      'adl case-study record-result <variant> --strengths "..." --weaknesses "..." --evidence "..." --no-score',
    ],
    guardrails: [
      'Keep ADL as the recorder, not the hidden prompt injector.',
      'Name the visible and withheld context in strategy metadata.',
      'Keep private session text out of the open tool repository.',
    ],
  },
];

export function listAdapters() {
  return adapters.map((adapter) => ({ ...adapter, aliases: [...adapter.aliases] }));
}

export function getAdapter(value) {
  const normalized = normalize(value);
  const adapter = adapters.find((record) => (
    record.id === normalized || record.aliases.some((alias) => normalize(alias) === normalized)
  ));
  if (!adapter) {
    throw new Error(`Unknown adapter: ${value}`);
  }
  return { ...adapter, aliases: [...adapter.aliases] };
}

export function renderAdapterGuide(value, options = {}) {
  const adapter = getAdapter(value);
  const variant = options.variant ?? '<variant>';
  const commands = adapter.commands.map((command) => command.replaceAll('<variant>', variant));

  return [
    `# ${adapter.name}`,
    '',
    `Adapter ID: ${adapter.id}`,
    '',
    'Provider-neutral adapter/plugin recipe for Agent Decision Lab.',
    '',
    'This guide is not an executable provider integration. It is a local operator',
    'recipe that keeps ADL responsible for recording decisions, variants, command',
    'runs, artifacts, and qualitative results while the human chooses which agent',
    'or tool to run.',
    '',
    '## Best For',
    '',
    ...adapter.bestFor.map((item) => `- ${item}`),
    '',
    '## Command Pattern',
    '',
    '```bash',
    ...commands,
    '```',
    '',
    '## Guardrails',
    '',
    ...adapter.guardrails.map((item) => `- ${item}`),
    '',
    '## Handoff',
    '',
    '- Attach this recipe to a case-study variant or onboarding checklist.',
    '- Record actual outputs as artifacts or command events.',
    '- Export redacted JSON, Markdown, SVG, or HTML before sharing.',
    '',
  ].join('\n');
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}
