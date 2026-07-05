# Product Requirements

## Product Summary

Agent Decision Lab is a local-first CLI for running controlled AI development
experiments across branching decision paths.

The user interacts with one experiment tree, marks decision points, starts
variants, records prompts and outputs, and maps each variant to an isolated Git
branch or worktree. The tool then renders the tree and exports structured data
for human review or LLM-assisted analysis.

## Problem

AI coding sessions are hard to compare fairly.

Developers often want to know whether one collaboration strategy works better
than another:

- Should the agent read the full project guidance first?
- Should the agent start with a product prompt only?
- Does spec-first development produce better code than implementation-first
  exploration?
- Does test-first guidance improve reliability?
- Does one model make safer architecture choices than another?

Today, these comparisons are mostly manual. The operator must create branches,
open separate agent sessions, remember what context each session received, save
notes, copy outputs, run tests, and later reconstruct the decision tree.

That manual process is fragile and does not scale beyond a few branches.

## Target Users

- Developers comparing AI coding workflows.
- Engineering teams developing repeatable agent collaboration practices.
- Researchers studying how context, instructions, tools, and workflow rules
  affect software outcomes.
- Maintainers who want auditable provenance for agent-assisted development
  without uploading private code or transcripts to a hosted service.

## Goals

- Make branching AI development experiments easy to create and resume.
- Keep each variant isolated in its own branch or worktree when needed.
- Preserve enough metadata to compare outcomes later.
- Produce human-readable and machine-readable experiment records.
- Keep the tool generic and open-source while keeping real experiment data
  private to the user workspace.
- Support later integration with coding agents, model APIs, and evaluation
  systems without requiring them in the MVP.

## Non-Goals

- Replace coding agents.
- Replace Git.
- Automatically decide which variant should merge.
- Store private experiment data in the open-source tool repository.
- Provide a hosted service in the first version.
- Require a specific model provider, editor, IDE, or coding agent.
- Guarantee deterministic LLM behavior.
- Hide or silently inject prompts into agent sessions.

## Key Concepts

### Experiment

A full investigation of one development goal.

Example: "Improve checkout validation in a toy application."

### Decision Point

A deliberate fork in collaboration strategy.

Example: "Should the agent read project guidance before design?"

### Savepoint

A restorable experiment anchor where new variants can be forked later.

A savepoint records enough state to recreate a clean branch from the same
starting point:

- Git commit;
- parent decision point;
- active variant or root experiment state;
- context policy;
- relevant prompt and artifact references;
- creation time and rationale.

A decision point asks the question. A savepoint preserves the state where that
question can be answered repeatedly.

### Variant

One path from a decision point.

Example: "guidance-first" or "prompt-only."

### Session

A period of interaction with a human and one or more agents inside a variant.

### Checkpoint

A named save point in the experiment record. A checkpoint may link to a Git
commit, working tree snapshot, prompt, response, note, test run, or artifact.

### Artifact

Any output worth comparing later, such as a design doc, diff, report, test
result, benchmark, transcript, or manual review note.

## MVP Requirements

### Experiment Lifecycle

- Initialize an experiment in a repository.
- Store metadata under a local experiment directory such as `.agent-lab/`.
- Record experiment title, description, owner, creation time, base repository,
  base commit, and schema version.
- List existing experiments.
- Show current experiment status.

### Decision Tree

- Create a decision point with title, rationale, and optional parent node.
- Create a savepoint for a decision point so the user can return later and fork
  another variant from the same state.
- Start a variant from a decision point.
- Start a variant from a savepoint.
- Support nested decision points under variants.
- Render the tree in the terminal.
- Export the tree as Markdown and JSON.

### Git Isolation

- Create or attach a branch for each variant.
- Create or attach a Git worktree for each variant when requested.
- Record branch name, worktree path, base commit, parent variant, and current
  commit.
- When starting from a savepoint, create the new branch from the savepoint commit
  rather than from the current working tree.
- Refuse unsafe operations when the working tree has uncommitted changes unless
  the user explicitly asks for an attach or continue operation.
- Never delete branches or worktrees without explicit confirmation.

### Session Logging

- Record prompts, responses, notes, decisions, checkpoints, command summaries,
  and artifacts.
- Support manual logging from stdin or editor input in the first version.
- Record timestamps and the active variant for each event.
- Support optional metadata: agent name, model, tool, temperature, system
  policy label, and context policy label.

### Export

- Export a machine-readable JSON bundle for LLM or analytics use.
- Export a human-readable Markdown summary.
- Include enough metadata to compare variants:
  - decision path;
  - prompts and context policy labels;
  - branches and commits;
  - artifact paths;
  - tests or checks run;
  - manual ratings;
  - notes and open questions.

### Privacy and Redaction

- Do not upload data automatically.
- Keep experiment records in the user workspace.
- Provide redaction hooks or built-in best-effort redaction before export.
- Make it clear when exports may contain private prompts, code snippets, file
  paths, or model outputs.
- Provide `.gitignore` guidance for private experiment data.

## Future Requirements

- Direct model or coding-agent adapters.
- Interactive TUI for tree navigation.
- Web dashboard for visual comparison.
- Integration with eval systems such as OpenAI Evals or Braintrust.
- Agent invocation wrappers that record prompts and outputs automatically.
- Rich diff comparison across variants.
- Scoring rubrics and LLM-assisted insight generation.
- Collaboration mode for multiple operators.

## Success Metrics

The MVP is successful when a user can:

- run one experiment with at least two variants;
- keep the variants isolated in Git;
- record prompts, outputs, checkpoints, and artifacts without manual file
  naming conventions;
- render the experiment tree;
- export JSON that another LLM can analyze;
- hand the experiment record to another developer who can understand what
  happened and where to continue;
- return to a savepoint and start another clean variant from the same recorded
  state.

## Example Case Study

The first public case study should use a toy repository or sanitized sample
workspace. The Lab should compare collaboration strategies without hard-coding
anything about a real product into the open-source core.
