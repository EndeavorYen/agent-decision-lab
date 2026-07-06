# Roadmap

## Phase 0: Product Definition

Status: complete for MVP.

Deliverables:

- README;
- product requirements;
- design document;
- testing strategy;
- security and privacy guidance;
- handoff notes;
- initial research notes.

## Phase 1: CLI Skeleton

Status: complete for MVP.

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

Status: complete for MVP.

Goal: create and validate local file-backed metadata.

Deliverables:

- `.agent-lab/` initialization;
- experiment schema;
- event JSONL writer;
- metadata reader and writer;
- status command;
- migration placeholder.

## Phase 3: Decision Tree

Status: complete for MVP.

Goal: manage decision points and variants without Git worktrees yet.

Deliverables:

- create decision point;
- create variant;
- append prompt, response, note, and checkpoint events;
- render tree;
- export Markdown and JSON.

## Phase 4: Git Branch and Worktree Isolation

Status: complete for MVP.

Goal: bind variants to isolated Git state.

Deliverables:

- branch creation;
- worktree creation;
- attach existing branch;
- dirty-tree detection;
- safe status and recovery output;
- integration tests with temporary repos.

## Phase 5: Privacy and Export Profiles

Status: complete for MVP summary exports; richer profiles remain future work.

Goal: make experiment output shareable when sanitized.

Deliverables:

- redaction profile;
- private versus summary export modes;
- export warnings;
- synthetic privacy tests;
- documentation for what can be committed.

## Phase 6: First Example Run

Status: ready to run against a toy or sanitized workspace.

Goal: use Agent Decision Lab to run a sample experiment against a toy repository
or sanitized workspace.

Deliverables:

- at least one experiment with two variants;
- exported comparison JSON;
- human-readable analysis;
- list of product gaps found while using the tool.

## Phase 7: Savepoint Forking

Status: implemented in MVP.

Goal: make decision points restorable so users can return to a recorded state
and grow another clean branch later.

Deliverables:

- savepoint entity with Git commit anchor;
- `savepoint create`;
- start branch or worktree from a savepoint commit;
- multiple variants from the same savepoint;
- dirty-state rejection for forkable savepoints;
- recovery output when a branch or worktree already exists.

## Phase 8: Strategy Experiment Layer

Status: implemented in MVP.

Goal: support A/B-style agent collaboration strategy experiments such as project guidance
visible versus prompt-only.

Deliverables:

- strategy metadata per variant;
- `context-ab` template;
- manual rubric and evaluation records;
- comparison report;
- Mermaid decision tree export with decision, savepoint, variant, artifact,
  evaluation, comparison, and guidance nodes;
- guidance draft from comparison results.

## Phase 9: Sanitized Case Study And Release Hardening

Status: complete for v0.1.0.

Goal: prove the tool on a real private workspace while publishing only sanitized
examples and release-safe documentation.

Deliverables:

- sanitized multi-agent worktree walkthrough;
- local-path redaction in default exports;
- case-study workflow commands;
- qualitative no-score comparison support;
- worktree lifecycle inspection and cleanup dry-runs;
- dashboard-style HTML report;
- provider-neutral adapter/plugin recipes;
- production onboarding and `adl doctor`;
- local realtime UI controls;
- guided orchestration and blank rebuild lab workflow;
- quiet/tail command capture;
- base lab metadata resolution from registered variant worktrees;
- Reality Slap Skill sanitized case-study summary;
- live-run evidence kept in the target workspace;
- verification that public examples omit raw transcripts and local paths.

## Later Phases

- Executable agent wrapper adapters.
- Direct model provider adapters.
- TUI tree navigator.
- SVG visual renderer.
- Hosted web dashboard.
- Evaluation framework integration.
- Multi-user collaboration.
- Hosted mode, only if privacy and governance requirements are clear.
