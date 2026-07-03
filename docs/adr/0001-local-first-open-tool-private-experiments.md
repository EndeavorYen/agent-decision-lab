# ADR 0001: Local-First Open Tool, Private Experiments

## Status

Proposed

## Context

Agent Decision Lab is intended to help developers compare different AI
collaboration strategies. The framework itself can be generic and useful to
others, but real experiments may include private prompts, organization-specific
standards, repository paths, code snippets, test logs, and model outputs.

Publishing experiment data by accident would make the tool unsafe to use in
real organizations.

## Decision

Agent Decision Lab will be developed as an open-source tool while treating real
experiment data as private workspace data.

The tool repository may contain only generic source code, schemas, docs,
synthetic tests, and sanitized examples.

Experiment records will be stored locally in the repository where the user runs
the tool, under a directory such as `.agent-lab/`.

The CLI will not upload data automatically.

## Consequences

Positive:

- The core can be open-source and reusable.
- Non-public experiments can stay private.
- The design encourages clean separation between framework and case study.
- Users can decide what to commit, ignore, redact, export, or share.

Negative:

- Users must understand data handling choices.
- Local-first storage may require extra work for team collaboration.
- A hosted dashboard is out of scope until privacy controls are mature.

## Follow-Up Decisions

- Define default `.gitignore` guidance for `.agent-lab/`.
- Define redaction profiles.
- Decide whether sanitized summaries can be tracked by default.
- Decide whether checkpoint metadata should ever live on a separate Git branch.
