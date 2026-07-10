# Handoff Notes

## Current State

This repository has a v0.2 release candidate CLI.

The documentation defines Agent Decision Lab as an open-source local-first CLI
for managing branching AI development experiments. The repository now also
contains a dependency-free Node.js implementation of the first workflow.

Implemented commands:

- `adl --help`
- `adl init`
- `adl doctor`
- `adl whereami`
- `adl context`
- `adl lab start`
- `adl privacy audit`
- `adl insight export`
- `adl mcp serve`
- `adl status`
- `adl migrate`
- `adl repair --dry-run`
- `adl adapter list`
- `adl adapter show`
- `adl adapter scaffold`
- `adl plugin list`
- `adl plugin show`
- `adl plugin scaffold`
- `adl experiment create`
- `adl experiment list`
- `adl experiment switch`
- `adl case-study init`
- `adl case-study add-variant`
- `adl case-study record-result`
- `adl case-study export`
- `adl decision create`
- `adl savepoint create`
- `adl savepoint checkout`
- `adl variant start`
- `adl variant checkout`
- `adl worktree list`
- `adl worktree status`
- `adl worktree cleanup --dry-run`
- `adl ui`
- `adl run`
- `adl run --quiet`
- `adl run --tail`
- `adl rebuild init`
- `adl orchestrate`
- `adl template context-ab`
- `adl strategy set`
- `adl artifact add`
- `adl evaluate`
- `adl compare`
- `adl guidance draft`
- `adl log prompt`
- `adl log response`
- `adl log note`
- `adl log command`
- `adl log artifact`
- `adl checkpoint`
- `adl tree`
- `adl export`

## Product Decision Already Made

Agent Decision Lab should be an open-source tool, while real experiments remain
private in the workspace where the tool is used.

Core boundary:

```text
Tool is open. Experiments are private.
```

## Implemented MVP

The CLI supports:

- `adl init`;
- `adl doctor`;
- `adl adapter list`;
- `adl adapter scaffold`;
- `adl plugin scaffold`;
- `adl case-study init`;
- `adl case-study add-variant`;
- `adl case-study record-result`;
- `adl case-study export`;
- `adl decision create`;
- `adl variant start`;
- `adl worktree list`;
- `adl worktree status`;
- `adl worktree cleanup --dry-run`;
- `adl ui`;
- `adl log prompt`;
- `adl log response`;
- `adl log note`;
- `adl checkpoint`;
- `adl tree`;
- `adl export`;
- `adl run --quiet`;
- `adl run --tail`;
- `adl rebuild init`;
- `adl orchestrate`.

The MVP uses manual transcript logging plus provider-neutral adapter/plugin
recipes. Direct model orchestration is still a future adapter layer, not a
dependency of the first usable version.

The v0.2 metadata schema is `agent-decision-lab/v2`. Mutations use a lab lock,
atomic JSON replacement, worktree-aware attribution, and a private operation
journal. Use `adl migrate --dry-run` before applying v1 migration and `adl
repair --dry-run` when doctor reports an incomplete operation.

## Current Stack

Current implementation: dependency-free Node.js ESM with JSDoc-friendly module
boundaries.

Reasons:

- easy JSON and Markdown handling;
- no install-time network dependency;
- built-in `node:test` runner;
- easy future migration to TypeScript once the public data model settles;
- accessible to many open-source contributors.

TypeScript remains a reasonable next step if distribution and contributor
workflow need stronger static checks. Go remains a reasonable alternative if
single-binary distribution becomes the top priority.

## Implementation Completed

- Project scaffold in `package.json`.
- CLI entrypoint in `bin/adl.js`.
- Core modules under `src/`.
- Store initialization under `.agent-lab/`.
- Multiple experiments per repository with current-experiment switching.
- Append-only event logging in `events.jsonl`.
- Decision and variant lifecycle.
- Clean savepoint forking.
- Strategy metadata, artifacts, rubrics, evaluations, comparisons, Mermaid,
  SVG, HTML tree export, and guidance drafts.
- Qualitative no-score evaluations and comparisons for human or LLM review.
- Case-study workflow commands that bundle the common decision/savepoint,
  variant, result-recording, comparison, guidance, and export flow.
- Worktree lifecycle inspection and cleanup dry-runs for ADL-owned worktrees.
- Git branch creation and optional worktree creation.
- Registered variant worktrees can run metadata commands by resolving the
  owning base lab store.
- Variant checkout and savepoint checkout for resuming or replaying a branch.
- Command-run capture for recording real local runs as experiment events.
- Quiet and tail modes for command-run capture.
- Guided orchestration output for deciding the next operator route.
- Blank rebuild lab setup for multi-agent reconstruction experiments.
- Local realtime UI with case-study controls, worktree variant creation, note
  logging, response logging, checkpoints, selected-route prompt rendering, HTML
  export, doctor checks, and Server-Sent Events.
- Guided `lab start` first-run flow for a clean two-variant strategy lab.
- `whereami`/`context` checkout orientation for base, registered variant
  worktree, and unknown checkout states.
- Privacy audit command for export and public-file preflight.
- Insight pack export for bounded human or LLM review.
- Local recorder-only MCP stdio server.
- Dirty-tree safety outside `.agent-lab/`.
- Tree rendering.
- JSON, Markdown, Mermaid, SVG, and dashboard-style HTML export.
- Summary-first exports with default redaction.
- Local filesystem path redaction in default exports.
- Sanitized multi-agent worktree case study documentation under
  `docs/examples/`.
- Temporary Git repository tests and live smoke script.

## Important Open Questions

- Should checkpoints create Git commits by default, or only metadata events?
- Should the package expose both `agent-lab` and `adl` commands? Current MVP
  exposes only `adl`.
- Should experiment exports include full transcripts by default? Current
  implementation says no; `--include-private` is required.
- Should branch/worktree paths be configurable globally, per repo, or per
  experiment?
- Should future agent adapters use `adl run` as their event-capture primitive,
  or write richer provider-specific event records?
- Should the MCP adapter add full SDK transport compatibility, or keep the
  dependency-free JSON-lines transport until a runtime dependency is accepted?

## First Example Run

The first sanitized example run uses this tool to compare collaboration
strategies against a real target workspace while keeping raw experiment data
private.

Decision point:

- Variant A: agent reads project guidance before coding.
- Variant B: agent receives only task-relevant code and tests.
- Variant C: agent writes the failing CLI test first.

The public walkthrough is
`docs/examples/multi-agent-worktree-case-study.md`. The private target
experiment produced patch artifacts, qualitative evaluations, comparison output,
and SVG/HTML/Markdown/JSON exports. Default export redaction now replaces local
worktree paths with `[REDACTED_LOCAL_PATH]`.

## Handoff Checklist

Before release or wider use:

- run `npm run verify`;
- review `docs/release-readiness.md`;
- keep at least one private live case study export as release evidence;
- run `adl privacy audit` on sanitized exports and public files;
- confirm sanitized insight packs do not include raw transcripts;
- decide whether to add TypeScript or linting before a larger public release.
