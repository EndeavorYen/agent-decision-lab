# MVP Implementation Design

This document records the original v0.1 storage design. The active v0.2
transaction, schema, and recovery model is documented in `docs/design.md`.

## Purpose

This document turns the product definition into the first usable implementation
of Agent Decision Lab.

The MVP is a local-first command line tool named `adl`. It manages an
experiment tree in a target Git repository, records manual session events, binds
variants to explicit Git branch or worktree state, renders the tree for humans,
and exports a structured bundle for later analysis.

The implementation intentionally does not invoke models or coding agents. Users
can keep using Codex, Claude Code, Gemini CLI, Copilot CLI, OpenCode, or any
other agent while `adl` records what happened.

## Runtime Shape

The first implementation uses Node.js ESM with no runtime dependencies.

Reasons:

- Node is already available in the target development environment.
- JSON, JSONL, Markdown, and process IO are native to the platform.
- A dependency-free CLI can be tested and used without network access.
- The code can later move to TypeScript without changing the public data model.

The package exposes one executable:

```bash
adl
```

During local development the same CLI can be invoked with:

```bash
node bin/adl.js
```

## Storage Layout

The CLI stores experiment data under the target repository:

```text
.agent-lab/
  config.json
  experiments/
    <experiment-id>/
      experiment.json
      tree.json
      events.jsonl
      artifacts.json
      variants/
        <variant-id>.json
      exports/
        latest.json
        latest.md
```

`config.json` records the current experiment and active variant. Experiment
files are ordinary JSON so humans can inspect and recover them manually.
`events.jsonl` is append-only.

## Entity Model

### Experiment

An experiment records the title, description, owner, creation time, schema
version, base repository metadata, and privacy defaults.

The MVP schema version is:

```text
agent-decision-lab/v1
```

### Decision Point

A decision point is a deliberate fork in collaboration strategy. It stores an
id, title, rationale, parent id, and creation time.

### Variant

A variant is one path from a decision point. It stores an id, name, decision id,
branch, optional worktree path, base commit, current commit, parent variant, and
status.

### Event

Events are append-only JSON lines. The MVP supports:

- `prompt`
- `response`
- `note`
- `checkpoint`
- `command`
- `artifact`

Each event records an id, type, experiment id, active variant id when available,
timestamp, actor, body, and metadata.

## Command Surface

The MVP supports:

```bash
adl --help
adl init "Experiment Title"
adl status
adl decision create "Decision Title" --rationale "Why this fork matters"
adl variant start variant-name --decision decision-title-or-id
adl variant start variant-name --decision decision-title-or-id --worktree
adl log prompt --stdin
adl log response --stdin
adl log note "Short note"
adl checkpoint "Named checkpoint"
adl tree
adl export --format json --out .agent-lab/experiments/<id>/exports/latest.json
adl export --format markdown --out .agent-lab/experiments/<id>/exports/latest.md
```

Commands are non-interactive and scriptable. If an operation may lose data or
overwrite user state, it fails closed with a clear recovery message.

## Git Behavior

`adl init` records the base repository path, remote, current branch, and current
commit. It does not create commits, branches, or worktrees.

`adl variant start` creates a branch for the variant by default:

```text
adl/<experiment-slug>/<variant-slug>
```

When `--worktree` is provided, the CLI creates a Git worktree at:

```text
../<repo-name>-agent-lab/<experiment-slug>/<variant-slug>
```

Safety rules:

- Refuse branch or worktree creation when the current working tree is dirty.
- Refuse to overwrite an unregistered worktree path.
- Never delete branches or worktrees.
- Never force-push or rewrite history.
- Allow attaching existing branches or worktrees only through explicit flags.

## Export and Privacy

The default export is shareable by design:

- event bodies are summarized rather than emitted in full;
- redaction runs by default;
- export metadata records whether redaction ran;
- full private export requires an explicit flag.

The first redaction profile covers common sensitive values:

- bearer tokens;
- API key assignments;
- password assignments;
- private key blocks;
- cookie headers;
- cloud access key shapes.

Redaction is best-effort. The CLI never treats redaction as permission to commit
private experiment data.

## Test Strategy

The MVP uses Node's built-in `node:test` runner. Tests cover:

- slug and id generation;
- local store initialization;
- decision and variant lifecycle;
- append-only event logging;
- tree rendering;
- JSON and Markdown export;
- redaction behavior;
- Git branch and worktree integration in temporary repositories;
- CLI smoke behavior.

Integration tests create temporary Git repositories and do not require network
access.

## Acceptance Criteria

The implementation is ready for first use when:

- `npm test` passes.
- `npm run smoke` passes against a temporary Git repository.
- `node bin/adl.js --help` shows the command surface.
- A live experiment can be initialized, forked into two variants, logged,
  rendered, and exported.
- The export contains experiment metadata, tree nodes, variants, events, Git
  state, and redaction metadata.
- No private real experiment data is committed to this repository.
