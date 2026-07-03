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

Pre-alpha design draft. The current repository contains product and engineering
specifications for the first implementation pass.

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

The first implementation should provide a CLI and file-based metadata store:

- initialize an experiment in a target repository;
- create decision points;
- start variants from a decision point;
- create or attach Git branches and worktrees for each variant;
- record prompts, responses, notes, checkpoints, commands, and artifacts;
- render the decision tree for humans;
- export structured JSON for later LLM or data analysis.

The MVP may support bring-your-own-agent workflows first. Direct model
orchestration can be added behind an adapter interface after the data model and
branching workflow are stable.

## Conceptual Workflow

```bash
adl init "Improve Checkout Flow"
adl decision create "Context strategy"
adl variant start --decision context-strategy --name guidance-first
adl log prompt --stdin
adl checkpoint "Design approved"
adl variant start --from context-strategy --name prompt-only
adl tree
adl export --format json --out reports/experiment-tree.json
```

The exact command names are part of the design draft and may change during
implementation.

## Documentation

- [Product Requirements](docs/product-requirements.md)
- [Goals](docs/goals.md)
- [Design](docs/design.md)
- [Testing Strategy](docs/testing-strategy.md)
- [Security and Privacy](docs/security-and-privacy.md)
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
