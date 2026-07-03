# AGENTS.md - Agent Decision Lab Project Guide

## Purpose

Agent Decision Lab is an open-source local-first CLI framework for managing
branching AI development experiments. It records decision points, variants,
branches, worktrees, prompts, outputs, checkpoints, artifacts, and evaluation
metadata so humans can compare how different agent strategies affect software
development outcomes.

The tool must stay generic. Private experiments, organization-specific
standards, non-public repository paths, private prompts, and real session
transcripts belong in the user workspace, not in this repository.

## Product Boundary

Hard rule:

```text
Tool is open. Experiments are private.
```

This repository may contain:

- generic CLI code;
- generic schemas;
- synthetic fixtures;
- documentation;
- examples using toy projects;
- adapters that are safe for public release.

This repository must not contain:

- private experiment transcripts;
- organization-specific standards or policy documents;
- real user or organization repository paths;
- credentials, tokens, cookies, API keys, or kubeconfigs;
- copied non-public code snippets from experiment targets;
- unredacted LLM outputs from private experiments.

## Development Workflow

- Keep behavior local-first and transparent.
- Prefer small, testable modules over large orchestration files.
- Treat prompt text, model output, command output, file paths, and experiment
  metadata as untrusted input.
- Use structured parsers and schemas instead of ad hoc string parsing when
  practical.
- Keep docs aligned when changing product behavior:
  - `README.md`;
  - `docs/product-requirements.md`;
  - `docs/design.md`;
  - `docs/testing-strategy.md`;
  - `docs/security-and-privacy.md`;
  - `docs/roadmap.md`;
  - `docs/handoff.md`.

## Implementation Direction

The first production-quality implementation should focus on:

1. File-backed experiment metadata.
2. Git branch and worktree isolation.
3. Decision node and variant lifecycle.
4. Prompt, response, note, checkpoint, command, and artifact logging.
5. Human-readable tree rendering.
6. JSON export for later LLM or data analysis.
7. Redaction and privacy guardrails.

Direct model orchestration is a later layer. Do not make the first version
depend on a specific model provider or coding agent.

## Testing Expectations

Before handing work back, run the project test command once one exists. Until
then, validate docs with:

```bash
git diff --check
git status --short
```

Future test coverage should include:

- CLI command parsing;
- metadata schema validation;
- temporary Git repository integration tests;
- worktree lifecycle tests;
- export golden-file tests;
- redaction tests;
- migration tests for metadata version changes.

## Git Rules

- Do not push unless the user explicitly asks.
- Do not force-push or rewrite history unless explicitly requested.
- Keep generated private experiment data out of this repository.
- Use concise commit messages, for example:

```text
docs: add initial product spec
feat: add experiment metadata store
test: cover worktree variant creation
```
