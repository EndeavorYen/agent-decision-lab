# Handoff Notes

## Current State

This repository is in product-definition mode.

The initial documentation defines Agent Decision Lab as an open-source
local-first CLI for managing branching AI development experiments.

No implementation exists yet.

## Product Decision Already Made

Agent Decision Lab should be an open-source tool, while real experiments remain
private in the workspace where the tool is used.

Core boundary:

```text
Tool is open. Experiments are private.
```

## Recommended MVP

Build a CLI that supports:

- `adl init`;
- `adl decision create`;
- `adl variant start`;
- `adl log prompt`;
- `adl log response`;
- `adl log note`;
- `adl checkpoint`;
- `adl tree`;
- `adl export`.

The MVP can use manual transcript logging. Direct model orchestration should be
designed as a future adapter layer, not required for the first usable version.

## Recommended Stack

Current recommendation: Node.js with TypeScript.

Reasons:

- good CLI ecosystem;
- easy JSON and Markdown handling;
- natural fit for schema validation;
- accessible to many open-source contributors;
- easy future integration with model SDKs;
- close enough to the first intended case study environment.

Go remains a reasonable alternative if single-binary distribution becomes the
top priority.

## First Implementation Plan Sketch

1. Create project scaffold.
2. Add CLI parser and `adl --help`.
3. Add schema definitions for experiment, decision, variant, event, and
   artifact metadata.
4. Implement `.agent-lab/` initialization.
5. Implement append-only event logging.
6. Implement tree rendering from metadata.
7. Implement JSON and Markdown export.
8. Add temporary Git repository integration tests.
9. Implement branch and worktree creation.
10. Add redaction and export privacy profiles.

## Important Open Questions

- Should `.agent-lab/` be committed, ignored, or split into public and private
  subdirectories?
- Should checkpoints create Git commits by default, or only metadata events?
- Should the first CLI include a TUI, or should it stay simple and scriptable?
- Should the package expose both `agent-lab` and `adl` commands?
- Should experiment exports include full transcripts by default? Current
  recommendation: no.
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

Before implementation starts:

- review and approve `docs/product-requirements.md`;
- resolve or defer open questions in `docs/design.md`;
- choose the implementation stack;
- decide whether `.agent-lab/` is tracked by default;
- create initial issues or milestones from `docs/roadmap.md`;
- define the first smoke test.
