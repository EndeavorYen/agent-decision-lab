# Testing Strategy

## Testing Goals

Agent Decision Lab manages Git state and experiment records. Tests must protect
against data loss, broken metadata, unsafe branch behavior, and privacy
regressions.

The test suite should make the CLI trustworthy before it manages real
experiments.

## Test Layers

### Unit Tests

Cover pure logic:

- slug generation;
- id generation;
- command option parsing;
- schema validation;
- tree construction;
- export rendering;
- redaction rules;
- path normalization;
- metadata migrations.

### Integration Tests

Use temporary Git repositories to verify real behavior:

- initialize an experiment in a clean repo;
- create a decision point;
- create a variant branch;
- create a variant worktree;
- attach an existing branch;
- detect dirty working trees;
- recover status after an interrupted command;
- export a tree after multiple variants.

Integration tests should not require network access.

Concurrency and recovery tests must verify that:

- twenty concurrent writers preserve every record and valid JSON;
- events recorded from separate worktrees use the invoking variant;
- v1 metadata migrates to v2 and unknown schemas fail closed;
- prepared or failed Git operations remain visible to doctor and repair
  dry-runs;
- unauthorized, cross-origin, and oversized local UI requests are rejected.

Savepoint integration tests should verify that:

- a forkable savepoint records the exact current commit;
- dirty working trees are rejected for clean savepoint creation;
- multiple variant branches can start from the same savepoint commit;
- returning to a savepoint creates a new branch or worktree instead of rewriting
  an existing path.

### Golden File Tests

Use synthetic fixtures to verify stable output:

- Markdown tree rendering;
- JSON export shape;
- comparison table rendering;
- redacted export rendering.

Golden files must not contain real private transcripts or non-public repository
paths.

### Privacy Tests

Verify that redaction and export controls behave as expected:

- token-like strings are redacted in exports;
- `adl privacy audit` catches secret-like values, local paths, and blocklist
  matches;
- private transcript fields can be omitted from summary exports;
- export metadata records whether redaction was applied;
- warnings appear before full transcript export.

### CLI Smoke Tests

Run end-to-end commands against a temporary repo:

```bash
adl init "Smoke Experiment"
adl decision create "Context strategy"
adl variant start prompt-only --decision context-strategy
adl log note "Initial note"
adl checkpoint "First checkpoint"
adl tree
adl export --format json --out export.json
```

The smoke test should assert that the export is valid JSON and references the
created decision, variant, and checkpoint.

The current repository provides:

```bash
npm test
npm run smoke
```

`npm test` runs unit, integration, export, redaction, savepoint, strategy,
comparison, visualization, MCP adapter, privacy audit, insight pack, whereami,
guided wizard, realtime UI, and CLI smoke tests with Node's built-in test
runner.
`npm run smoke` creates a temporary Git repository, initializes a live synthetic
project guidance strategy experiment with three variants from one savepoint, logs events,
records artifacts and evaluations, renders the tree, writes JSON/Markdown/
Mermaid exports, creates a comparison report, and drafts guidance.

## Test Data Policy

All test data must be synthetic.

Do not commit:

- real AI transcripts;
- private prompts;
- organization-specific policy documents;
- non-public repository paths;
- copied code from private targets;
- credentials or token-like examples that are not clearly fake.

Use obvious fake values such as:

```text
fake-token-for-redaction-test
example.invalid
org/example-repo
```

## Manual Validation

Before a release or handoff, run:

```bash
git diff --check
git status --short
```

Once an implementation exists, add the project test command here and run it
before handoff.

Current verification commands:

```bash
npm test
npm run smoke
npm run coverage
npm run privacy
git diff --check
git status --short
```

## Acceptance Criteria for MVP

The MVP test suite should prove that:

- metadata is valid after every supported CLI command;
- `adl doctor` reports Git, Node, experiment, privacy-ignore, and dirty-tree
  readiness;
- `adl whereami` identifies base, registered variant worktree, and unknown
  checkout context;
- `adl lab start` creates a guided two-variant strategy lab and rejects dirty
  non-lab files;
- `adl privacy audit` catches public-sharing disclosure risks;
- `adl insight export` writes a bounded redacted analysis pack;
- `adl mcp serve` exposes recorder-only MCP tools and can log events;
- `adl ui` can initialize a case study, add a variant, log a note, export HTML,
  render prompts, record responses and checkpoints, and stream realtime state
  with Server-Sent Events;
- ADL metadata commands invoked inside registered variant worktrees resolve the
  owning base lab store;
- `adl run --quiet` and `adl run --tail` reduce terminal noise while preserving
  command evidence;
- `adl rebuild init` creates an isolated blank rebuild lab while preserving keep
  files;
- `adl orchestrate` renders next-route guidance and records responses and
  checkpoints;
- adapter/plugin recipe commands list, show, and scaffold provider-neutral
  guidance;
- multiple experiments can coexist in one target repository;
- case-study workflow commands can create variants, record qualitative results,
  and export a report pack;
- no-score evaluations render as qualitative findings instead of zero scores;
- worktree lifecycle commands list, summarize, and dry-run cleanup registered
  ADL worktrees;
- variant branches and worktrees are created without overwriting user work;
- tree rendering matches the stored metadata;
- JSON exports are deterministic;
- redaction can be applied before sharing exports;
- redacted exports remove local home-directory and temporary worktree paths;
- a user can resume an experiment after closing the terminal;
- a user can return to a savepoint and fork another clean variant from the same
  recorded state.
- a user can checkout a recorded variant branch;
- a user can capture a real command run under a variant;
- a user can export a standalone SVG tree and dashboard-style HTML report.
