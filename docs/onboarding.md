# Production Onboarding

This guide is the first production path for using Agent Decision Lab in a real
target repository.

It assumes the operator brings their own coding agent, review process, or local
script. ADL records the decision tree and evidence; it does not secretly inject
prompts or run a model provider.

## First 15 Minutes

From the Agent Decision Lab checkout:

```bash
npm test
npm link
adl --help
```

From the target repository:

```bash
adl doctor
adl whereami
```

If the doctor warns that private experiment data is not ignored, add this to
the target repository's `.gitignore` unless that repository intentionally tracks
experiment metadata:

```gitignore
.agent-lab/
```

Initialize the case study with the guided first-run command:

```bash
adl lab start "Agent Strategy Case Study" \
  --decision "Which collaboration strategy should the agent use?" \
  --savepoint "Before strategy fork" \
  --variants docs-visible,prompt-only \
  --context-policies docs-visible,prompt-only \
  --worktree
```

The command refuses to continue when non-lab files are dirty. If you need the
manual flow instead, use the lower-level commands:

```bash
adl case-study init "Agent Strategy Case Study" \
  --decision "Which collaboration strategy should the agent use?" \
  --savepoint "Before strategy fork" \
  --rationale "Compare prompt, context, and workflow choices from one clean state"
```

Scaffold an adapter/plugin recipe:

```bash
adl adapter scaffold manual --out .agent-lab/adapters/manual.md
adl plugin scaffold command-wrapper --out .agent-lab/adapters/command-wrapper.md
```

Create variants from the same savepoint:

```bash
adl case-study add-variant docs-visible \
  --from "Before strategy fork" \
  --context-policy docs-visible \
  --worktree

adl case-study add-variant prompt-only \
  --from "Before strategy fork" \
  --context-policy prompt-only \
  --worktree
```

Record commands and results:

```bash
adl log prompt --variant docs-visible --stdin
adl run --variant docs-visible -- npm test
adl case-study record-result docs-visible \
  --strengths "stronger alignment with project guidance" \
  --weaknesses "more context to filter" \
  --evidence "verification command recorded" \
  --no-score
```

Export a redacted report pack:

```bash
adl case-study export docs-visible prompt-only \
  --out-dir .agent-lab/exports/strategy-case
adl insight export --variants docs-visible,prompt-only \
  --out .agent-lab/exports/strategy-case/insight-pack.json
adl privacy audit --path .agent-lab/exports/strategy-case
```

Open the generated HTML report from the private target workspace for review.
Commit only sanitized summaries or patches that are intentionally public.

## Adapter And Plugin Recipes

`adl adapter` and `adl plugin` are aliases for the same provider-neutral recipe
surface:

```bash
adl adapter list
adl adapter show manual
adl adapter scaffold manual --variant docs-visible
adl plugin scaffold command-wrapper --variant prompt-only
```

The current recipes are intentionally lightweight:

- `manual`: operator logs prompts, responses, commands, artifacts, and results;
- `command-wrapper`: operator records local command evidence through `adl run`;
- `codex-session`: operator uses Codex as the agent while ADL remains the
  recorder.

These are plugin recipes, not executable provider integrations. They establish
the shape that future agent-specific adapters can implement without making the
v0.1.0 release depend on a model provider.

## Readiness Checklist

Before relying on a case study:

- run `adl doctor` in the target repository;
- run `adl whereami` before recording events from a branch or worktree;
- confirm `.agent-lab/` is ignored or intentionally private;
- create variants from one clean savepoint;
- record visible and withheld context in strategy metadata;
- use `adl run` for verification commands;
- use `--no-score` when human or LLM review will judge outcomes later;
- export JSON, Markdown, SVG, and HTML with redaction enabled;
- scan public exports with `adl privacy audit` before sharing.

## MCP Adapter

For MCP-capable local agents, start the stdio adapter from the target
repository:

```bash
adl mcp serve
```

The first MCP adapter exposes typed ADL recording tools only. It can inspect
doctor/status/context, render the tree, generate orchestrator guidance, and
record prompt, response, note, checkpoint, and supplied command metadata. It
does not run arbitrary shell commands, call model providers, commit, push,
merge, or upload lab data.

## Recovery Checklist

When a run is interrupted:

- run `adl status`;
- run `adl worktree list`;
- run `adl worktree status`;
- inspect the target worktree directly before deleting anything;
- use `adl worktree cleanup --dry-run` to preview cleanup only;
- return to a savepoint with `adl savepoint checkout <savepoint> --branch <new-branch>`.
