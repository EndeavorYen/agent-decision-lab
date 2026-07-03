# Roadmap

## Phase 0: Product Definition

Status: in progress.

Deliverables:

- README;
- product requirements;
- design document;
- testing strategy;
- security and privacy guidance;
- handoff notes;
- initial research notes.

## Phase 1: CLI Skeleton

Goal: establish the project as an installable CLI with tests.

Deliverables:

- package or binary scaffold;
- `adl --help`;
- command routing;
- logging and error conventions;
- test runner;
- lint or formatting command;
- release-agnostic version metadata.

## Phase 2: Experiment Store

Goal: create and validate local file-backed metadata.

Deliverables:

- `.agent-lab/` initialization;
- experiment schema;
- event JSONL writer;
- metadata validator;
- status command;
- migration placeholder.

## Phase 3: Decision Tree

Goal: manage decision points and variants without Git worktrees yet.

Deliverables:

- create decision point;
- create variant;
- append prompt, response, note, and checkpoint events;
- render tree;
- export Markdown and JSON.

## Phase 4: Git Branch and Worktree Isolation

Goal: bind variants to isolated Git state.

Deliverables:

- branch creation;
- worktree creation;
- attach existing branch or worktree;
- dirty-tree detection;
- safe status and recovery output;
- integration tests with temporary repos.

## Phase 5: Privacy and Export Profiles

Goal: make experiment output shareable when sanitized.

Deliverables:

- redaction profile;
- private versus summary export modes;
- export warnings;
- synthetic privacy tests;
- documentation for what can be committed.

## Phase 6: First Example Run

Goal: use Agent Decision Lab to run a sample experiment against a toy repository
or sanitized workspace.

Deliverables:

- at least one experiment with two variants;
- exported comparison JSON;
- human-readable analysis;
- list of product gaps found while using the tool.

## Later Phases

- Agent wrapper adapters.
- Direct model provider adapters.
- TUI tree navigator.
- Web dashboard.
- Evaluation framework integration.
- Multi-user collaboration.
- Hosted mode, only if privacy and governance requirements are clear.
