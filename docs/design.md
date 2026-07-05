# Design

## Architecture Overview

Agent Decision Lab is a CLI and local metadata store layered on top of Git.

It does not replace the coding agent. In the MVP, the user can keep using
Codex, Claude Code, Gemini CLI, Copilot CLI, OpenCode, or any other tool. The
Lab records the decision tree and binds each path to Git state.

```mermaid
flowchart TD
  user[Human operator] --> cli[ADL CLI]
  cli --> store[Experiment store]
  cli --> git[Git and worktree manager]
  cli --> logs[Session event logger]
  cli --> export[Export renderer]
  agent[External coding agent] --> workspace[Variant workspace]
  workspace --> git
  logs --> store
  git --> store
  store --> export
  export --> human[Markdown summary]
  export --> json[JSON bundle]
```

## Repository Roles

There are two repository types:

### Tool Repository

This repository. It contains the generic CLI, schemas, docs, tests, and
synthetic examples.

### Experiment Workspace

The target repository where a user runs experiments. It contains `.agent-lab/`
metadata, private transcripts, branch mappings, and artifacts for that
experiment.

The tool repository must not contain real private experiment data.

## Storage Model

The default store is file-backed and local:

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

The store should be simple enough to inspect manually and strict enough to
validate with schemas.

## Core Entity Model

### Core Relationship

The experiment tree separates questions from restorable state:

```text
Experiment
  -> Decision Point: the question being tested
      -> Savepoint: the Git and context state that can be forked again
          -> Variant: one choice made from that savepoint
              -> Decision Point: a later nested question
```

A decision point is not enough by itself. It must have a savepoint when the user
needs to return later and create another clean branch from the same state.

### Experiment

```json
{
  "schemaVersion": "agent-decision-lab/v1",
  "id": "exp_20260703_checkout_flow",
  "title": "Improve Checkout Flow",
  "description": "Compare collaboration strategies while improving checkout validation in a toy app.",
  "createdAt": "2026-07-03T10:00:00.000Z",
  "baseRepository": {
    "path": "/path/to/repo",
    "remote": "git@example.com:org/repo.git",
    "baseRef": "main",
    "baseCommit": "abc123"
  },
  "privacy": {
    "classification": "private",
    "redactionProfile": "default"
  }
}
```

### Decision Point

```json
{
  "id": "dec_context_strategy",
  "type": "decision",
  "title": "Context strategy",
  "rationale": "Compare outcomes when the agent does or does not receive project guidance before design.",
  "parentId": "root",
  "createdAt": "2026-07-03T10:10:00.000Z"
}
```

### Savepoint

```json
{
  "id": "sp_read_project_guidance",
  "type": "savepoint",
  "decisionId": "dec_context_strategy",
  "title": "Read project guidance?",
  "rationale": "Preserve the state before choosing how much project guidance context the agent sees.",
  "git": {
    "commit": "abc123",
    "branch": "main",
    "isDirty": false
  },
  "context": {
    "policy": "pre-decision",
    "artifacts": []
  },
  "parentVariantId": null,
  "createdAt": "2026-07-03T10:12:00.000Z"
}
```

A savepoint is the fork anchor. Starting another strategy later should create a
new branch or worktree from `git.commit`, not from whichever branch the user is
currently on.

### Variant

```json
{
  "id": "var_guidance_first",
  "type": "variant",
  "decisionId": "dec_context_strategy",
  "savepointId": "sp_read_project_guidance",
  "name": "guidance-first",
  "promptSummary": "Agent reads project guidance before design.",
  "branch": "adl/exp-checkout-flow/guidance-first",
  "worktreePath": "../agent-lab-worktrees/guidance-first",
  "baseCommit": "abc123",
  "currentCommit": "def456",
  "status": "active"
}
```

### Event

Events are append-only JSON lines.

```json
{
  "id": "evt_001",
  "type": "prompt",
  "experimentId": "exp_20260703_checkout_flow",
  "variantId": "var_guidance_first",
  "createdAt": "2026-07-03T10:20:00.000Z",
  "actor": "human",
  "body": "Please design the checkout validation change after reading the project guidance.",
  "metadata": {
    "agent": "codex",
    "model": "gpt-5",
    "contextPolicy": "guidance-visible"
  }
}
```

## CLI Design

The exact command names can change, but the first implementation should support
these workflows.

### Initialize

```bash
adl init "Improve Checkout Flow"
```

Creates `.agent-lab/`, records base Git state, and creates the root experiment.

### Create a Decision Point

```bash
adl decision create "Context strategy" \
  --rationale "Compare standard-visible and prompt-only development"
```

### Create a Savepoint

```bash
adl savepoint create "Read project guidance?" \
  --decision context-strategy \
  --rationale "Fork strategies from the same pre-context state"
```

The savepoint records the current commit and context policy. The CLI should
refuse to create a savepoint from a dirty working tree unless the user explicitly
chooses a metadata-only checkpoint that cannot be used for clean Git forking.

### Start a Variant

```bash
adl variant start guidance-first \
  --from read-project-guidance \
  --worktree
```

Creates or attaches a branch and optional worktree from the savepoint commit.

### Log Session Events

```bash
adl log prompt --stdin
adl log response --stdin
adl log note "The agent asked for acceptance criteria before coding."
adl checkpoint "Design approved"
```

Manual logging is enough for MVP. Agent adapters can automate this later.

### Render and Export

```bash
adl tree
adl export --format markdown --out .agent-lab/exports/latest.md
adl export --format json --out .agent-lab/exports/latest.json
adl export --format svg --out .agent-lab/exports/tree.svg
adl export --format html --out .agent-lab/exports/report.html
```

When the target repository already has experiment data, create a separate
experiment instead of replacing `.agent-lab/`:

```bash
adl experiment create "Bald Patch Case Study"
adl experiment list
adl experiment switch "Bald Patch Case Study"
```

Command output can be captured without a model-provider dependency:

```bash
adl run --variant prompt-only -- npm test
```

To resume or replay work:

```bash
adl variant checkout prompt-only
adl savepoint checkout read-project-guidance --branch adl/replay/read-project-guidance
```

## Branch and Worktree Strategy

Each variant should have one Git branch. Worktrees are optional but recommended
when variants may be developed concurrently or need separate runtime state.

Default branch pattern:

```text
adl/<experiment-slug>/<variant-slug>
```

Default worktree pattern:

```text
../<repo-name>-agent-lab/<experiment-slug>/<variant-slug>
```

The Git manager must:

- create new variant branches from the savepoint commit;
- detect dirty working trees before switching or branching;
- record base commit and current commit;
- avoid deleting worktrees or branches without explicit confirmation;
- support attaching an existing branch or worktree;
- support checking out a recorded variant branch;
- support creating or checking out a branch from a savepoint commit;
- expose enough status to recover from interrupted runs.

Returning to a savepoint must not rewrite or discard the current path. It should
create a new branch or worktree that starts from the saved commit.

## Model and Agent Integration

The MVP should not depend on one model provider.

The design should leave room for adapters:

```mermaid
flowchart LR
  cli[ADL CLI] --> adapter[Agent adapter interface]
  adapter --> manual[Manual transcript logging]
  adapter --> codex[Codex CLI wrapper]
  adapter --> claude[Claude Code wrapper]
  adapter --> openai[OpenAI API provider]
  adapter --> other[Other agents]
```

Adapter responsibilities:

- capture submitted prompts;
- capture visible responses;
- record model/tool metadata when available;
- associate outputs with the active experiment variant;
- avoid hidden prompt injection.

The first version can implement only the manual adapter while preserving the
interface.

## Export Design

Exports should be deterministic and stable enough for analysis.

The JSON export should include:

- experiment metadata;
- tree nodes;
- savepoints and their Git anchors;
- variants;
- event summaries or full event bodies depending on privacy settings;
- artifact index;
- Git state;
- test/check results;
- manual scores;
- redaction metadata.

When redaction is enabled, exports must redact common credentials and local
filesystem paths such as worktree locations. Public exports should show
`[REDACTED_LOCAL_PATH]` instead of paths under user home directories or local
temporary directories.

The Markdown export should include:

- executive summary;
- decision tree;
- savepoint and fork summary;
- variant comparison table;
- artifacts;
- open questions;
- next actions.

## Error Handling

The CLI should prefer fail-closed behavior for operations that may lose data.

Examples:

- refuse to start a variant if the target worktree path already exists and is
  not registered;
- refuse to switch branches with uncommitted changes unless the user explicitly
  attaches or checkpoints;
- warn before exporting full transcripts;
- validate metadata files before writing derived exports;
- preserve append-only event logs even if rendering fails.

## Open Questions

- Should `.agent-lab/` be ignored by default, tracked by default, or split into
  tracked metadata and ignored transcript storage?
- Should the CLI provide a lightweight TUI in the MVP or stay command-only?
- Should checkpoints create Git commits, only metadata events, or support both?
- Should redaction run at log time, export time, or both?
- Should experiments be stored in the target repo or in a separate lab repo?
- Should `savepoint create` require a clean working tree for every forkable
  savepoint, and use a separate metadata-only checkpoint command for dirty
  states?
