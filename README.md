# Agent Decision Lab

Agent Decision Lab is a local-first CLI framework for running branching AI
development experiments.

It helps developers compare how different agent strategies affect software
outcomes. Instead of managing many chat sessions, branches, worktrees, prompts,
and notes by hand, the Lab records the experiment tree:

- what decision point was created;
- what prompt, context policy, or workflow rule changed;
- which branch or worktree belongs to each path;
- what the agent produced;
- what tests or checks ran;
- what artifacts should be compared later.

The core idea is simple:

> Tool is open. Experiments are private.

This repository should contain the generic framework only. Real experiment
data, private prompts, organization-specific standards, non-public repository
paths, and session transcripts belong in the private workspace where the tool is
used.

## Status

MVP CLI implemented. The current repository contains product and engineering
specifications plus a dependency-free Node.js command line tool for the first
local experiment workflow.

## Why This Exists

AI coding agents can produce very different results depending on what they are
shown and how they are guided. For example, one experiment may compare:

- strategy A: give the agent a project guidance document before design;
- strategy B: hide that guidance and provide only the product prompt;
- strategy C: require spec-first and test-first development;
- strategy D: allow implementation-first exploration.

Without a framework, these experiments are painful to run. The human operator
must remember which session saw which context, manually create branches, avoid
worktree collisions, collect outputs, and later reconstruct why one path worked
better than another.

Agent Decision Lab treats these choices as a first-class decision tree.

## Example Use Case

A sample experiment might improve checkout validation in a toy application. One
variant gives the agent a project guidance document before design, while another
variant provides only the feature prompt.

The Lab itself should not know about any real product or organization. It only
provides the generic experiment machinery.

## MVP Shape

The first implementation provides a CLI and file-based metadata store:

- initialize an experiment in a target repository;
- create decision points;
- start variants from a decision point;
- create Git branches and optional worktrees for each variant;
- record prompts, responses, notes, checkpoints, commands, and artifacts;
- render the decision tree for humans;
- export structured JSON and Markdown for later human, LLM, or data analysis;
- run summary-first export with redaction enabled by default.

The MVP supports bring-your-own-agent workflows first. Direct model
orchestration remains a later adapter layer.

## Install and Run Locally

This package has no runtime dependencies. From this repository:

```bash
npm test
node bin/adl.js --help
```

To try the installed command locally:

```bash
npm link
adl --help
```

## Conceptual Workflow

```bash
adl init "Improve Checkout Flow"
adl experiment create "Bald Patch Case Study"
adl experiment list
adl experiment switch "Bald Patch Case Study"
adl case-study init "Review JSON Case Study" \
  --decision "Context strategy" \
  --savepoint "Before task" \
  --rationale "Compare guidance-visible and prompt-only runs"
adl case-study add-variant guidance-first \
  --from before-task \
  --context-policy guidance-visible \
  --worktree
adl log prompt --stdin
adl run --variant guidance-first -- npm test
adl checkpoint "Design approved"
adl case-study add-variant prompt-only \
  --from before-task \
  --context-policy prompt-only \
  --worktree
adl case-study record-result guidance-first \
  --artifact outputs/guidance-first.patch \
  --strengths "aligned with project guidance" \
  --weaknesses "more setup" \
  --evidence "npm test passed" \
  --no-score
adl case-study export guidance-first prompt-only \
  --out-dir .agent-lab/exports/review-json-case
adl variant checkout guidance-first
adl savepoint checkout before-task --branch adl/replay/before-task
adl worktree list
adl worktree status
adl worktree cleanup --dry-run
adl tree
adl export --format json --out .agent-lab/exports/latest.json
adl export --format markdown --out .agent-lab/exports/latest.md
adl export --format html --out .agent-lab/exports/report.html
```

The CLI stores records under `.agent-lab/` in the target repository. Event
bodies are omitted from default exports, and local filesystem paths are
redacted by default; pass `--include-private` only for private, local analysis.

Use `adl experiment create` when a repository already has `.agent-lab/` data
and you want a separate case study without overwriting previous experiments.

For a complete sanitized walkthrough of a multi-agent, multi-worktree case
study, see
[`docs/examples/multi-agent-worktree-case-study.md`](docs/examples/multi-agent-worktree-case-study.md).

## Strategy Experiment Workflow

Use `context-ab` when the decision is whether an agent should see planning
context before doing the task:

```bash
adl template context-ab \
  --question "Should the agent read project guidance before writing code review rules?" \
  --decision "Context visibility" \
  --a guidance-visible \
  --b prompt-only \
  --c draft-then-compare

adl evaluate guidance-visible --scores '{"alignment":5,"specificity":4}'
adl compare guidance-visible prompt-only draft-then-compare --out .agent-lab/exports/comparison.md
adl export --format mermaid --out .agent-lab/exports/tree.mmd
adl export --format svg --out .agent-lab/exports/tree.svg
adl export --format html --out .agent-lab/exports/report.html
adl guidance draft \
  --comparison cmp_guidance_visible_vs_prompt_only_vs_draft_then_compare \
  --out .agent-lab/exports/guidance.md
```

The template creates a decision point, a clean savepoint, and variants that fork
from the same saved commit.

Use `--no-score` when humans or later LLM review should judge the artifacts
qualitatively. In that mode, comparison reports show `not scored`, strengths,
weaknesses, evidence, no selected winner, and a recommended next experiment.

Use `adl run --variant <name> -- <command...>` to capture real command output
as a command event. This is useful for recording test runs, agent wrapper runs,
or local review scripts without depending on a specific model provider.

## Documentation

- [Product Requirements](docs/product-requirements.md)
- [Goals](docs/goals.md)
- [Design](docs/design.md)
- [MVP Implementation Design](docs/mvp-implementation-design.md)
- [Testing Strategy](docs/testing-strategy.md)
- [Security and Privacy](docs/security-and-privacy.md)
- [Release Readiness](docs/release-readiness.md)
- [Roadmap](docs/roadmap.md)
- [Research Notes](docs/research-notes.md)
- [Handoff Notes](docs/handoff.md)

## Design Principles

- Local-first by default.
- Model-agnostic and agent-agnostic.
- Git-native isolation with explicit branch/worktree ownership.
- Structured metadata that humans and LLMs can inspect.
- Private experiment data stays outside the open-source tool repository.
- No automatic uploads.
- No hidden prompts, hidden policy, or silent context injection.
- Every exported insight should be traceable to recorded experiment metadata.

## License

MIT. See [LICENSE](LICENSE).
