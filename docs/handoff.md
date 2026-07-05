# Handoff Notes

## Current State

This repository has a usable MVP CLI.

The documentation defines Agent Decision Lab as an open-source local-first CLI
for managing branching AI development experiments. The repository now also
contains a dependency-free Node.js implementation of the first workflow.

Implemented commands:

- `adl --help`
- `adl init`
- `adl status`
- `adl decision create`
- `adl variant start`
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
- `adl decision create`;
- `adl variant start`;
- `adl log prompt`;
- `adl log response`;
- `adl log note`;
- `adl checkpoint`;
- `adl tree`;
- `adl export`.

The MVP uses manual transcript logging. Direct model orchestration is still a
future adapter layer, not a dependency of the first usable version.

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
- Append-only event logging in `events.jsonl`.
- Decision and variant lifecycle.
- Git branch creation and optional worktree creation.
- Dirty-tree safety outside `.agent-lab/`.
- Tree rendering.
- JSON and Markdown export.
- Summary-first exports with default redaction.
- Temporary Git repository tests and live smoke script.

## Important Open Questions

- Should `.agent-lab/` be committed, ignored, or split into public and private
  subdirectories?
- Should checkpoints create Git commits by default, or only metadata events?
- Should the package expose both `agent-lab` and `adl` commands? Current MVP
  exposes only `adl`.
- Should experiment exports include full transcripts by default? Current
  implementation says no; `--include-private` is required.
- Should branch/worktree paths be configurable globally, per repo, or per
  experiment?

## First Example Run

The first example run should use this tool to compare collaboration strategies
against a toy repository or sanitized workspace.

Candidate first decision point:

- Variant A: agent reads project guidance before design.
- Variant B: agent receives only product goals and user-provided prompts.

The case study should produce a private experiment export that can be analyzed
for differences in requirements, architecture, tests, safety decisions, and
implementation quality.

## Handoff Checklist

Before release or wider use:

- decide whether `.agent-lab/` is tracked by default;
- run `npm test`;
- run `npm run smoke`;
- run `git diff --check`;
- run a real private experiment in a toy repository;
- decide whether to add TypeScript, linting, or packaging automation before
  publishing.
