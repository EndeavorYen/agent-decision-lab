# Multi-Agent Worktree Case Study

This example shows how to use Agent Decision Lab to run a real multi-agent,
multi-worktree coding experiment while keeping private run data out of the
open-source tool repository.

The source run behind this example used a real public target project and a
small production task. This document is the sanitized public version: local
paths are replaced with placeholders, raw agent transcripts are omitted, and
private `.agent-lab/` data stays in the target workspace.

## Goal

Compare how different agent collaboration strategies affect the same coding
task.

Case task:

```text
Add `--json` support to a review CLI so the default Markdown output remains
unchanged, while `review --json` prints the existing structured review object
as pretty JSON with a trailing newline.
```

Strategies compared:

| Variant | Strategy | Intent |
| --- | --- | --- |
| `docs-visible` | Read project docs before coding | Measure whether broader context improves fit. |
| `prompt-only` | Read only task-relevant code and tests | Measure focused execution without extra context. |
| `test-first` | Write the failing CLI test first | Measure whether explicit red/green work improves proof. |

## Runbook

Create a separate experiment in the target repository:

```bash
adl experiment create "Multi-Agent Worktree Case Study"
adl decision create "Choose agent collaboration strategy" \
  --rationale "Compare how context and test-first guidance affect a small CLI change."
adl savepoint create "Before review JSON task" \
  --decision choose-agent-collaboration-strategy
```

Create one clean worktree per variant from the same savepoint:

```bash
adl variant start docs-visible \
  --from before-review-json-task \
  --branch adl/case-study-review-json/docs-visible \
  --worktree \
  --worktree-path <worktree-root>/docs-visible \
  --prompt-summary "Read relevant docs before implementing."

adl variant start prompt-only \
  --from before-review-json-task \
  --branch adl/case-study-review-json/prompt-only \
  --worktree \
  --worktree-path <worktree-root>/prompt-only \
  --prompt-summary "Use only task-relevant code and tests."

adl variant start test-first \
  --from before-review-json-task \
  --branch adl/case-study-review-json/test-first \
  --worktree \
  --worktree-path <worktree-root>/test-first \
  --prompt-summary "Add the failing CLI JSON test before implementation."
```

Record strategy metadata:

```bash
adl strategy set docs-visible \
  --from before-review-json-task \
  --context-policy docs-visible \
  --prompt-summary "Read README and relevant docs first."

adl strategy set prompt-only \
  --from before-review-json-task \
  --context-policy prompt-only \
  --prompt-summary "Avoid broad docs and inspect only needed code/tests."

adl strategy set test-first \
  --from before-review-json-task \
  --context-policy test-first \
  --prompt-summary "Capture a red test before implementation."
```

Give each worker agent a different prompt policy and its assigned worktree.
Agents should not commit, push, or touch other worktrees. They should leave the
diff in place and report files changed plus tests run.

After each worker finishes, verify through ADL so the command output becomes
part of the experiment record:

```bash
adl run --variant docs-visible -- npm --prefix <worktree-root>/docs-visible test
adl run --variant prompt-only -- npm --prefix <worktree-root>/prompt-only test
adl run --variant test-first -- npm --prefix <worktree-root>/test-first test
```

Store each patch as an artifact:

```bash
git -C <worktree-root>/docs-visible diff \
  --output=.agent-lab/experiments/<experiment-id>/case-study-artifacts/docs-visible.patch
git -C <worktree-root>/prompt-only diff \
  --output=.agent-lab/experiments/<experiment-id>/case-study-artifacts/prompt-only.patch
git -C <worktree-root>/test-first diff \
  --output=.agent-lab/experiments/<experiment-id>/case-study-artifacts/test-first.patch

adl artifact add patch-docs-visible \
  --variant docs-visible \
  --path .agent-lab/experiments/<experiment-id>/case-study-artifacts/docs-visible.patch
adl artifact add patch-prompt-only \
  --variant prompt-only \
  --path .agent-lab/experiments/<experiment-id>/case-study-artifacts/prompt-only.patch
adl artifact add patch-test-first \
  --variant test-first \
  --path .agent-lab/experiments/<experiment-id>/case-study-artifacts/test-first.patch
```

Record qualitative evaluation without assigning scores:

```bash
adl evaluate docs-visible \
  --strengths "smallest test diff; package-script smoke covers npm invocation" \
  --weaknesses "looser assertions; test observes current repo state" \
  --evidence "full npm test passed; script diff +8/-2 and test diff +33"

adl evaluate prompt-only \
  --strengths "focused implementation; exact default Markdown and JSON assertions" \
  --weaknesses "uses repository HEAD as base; less isolated than temp fixture" \
  --evidence "full npm test passed; script diff +8/-2 and test diff +53"

adl evaluate test-first \
  --strengths "captured red green sequence; isolated temp git repo test" \
  --weaknesses "largest test diff; more helper setup to maintain" \
  --evidence "red test observed then full npm test passed; script diff +8/-2 and test diff +96/-1"
```

Create comparison, guidance, and visual exports:

```bash
adl compare docs-visible prompt-only test-first \
  --out .agent-lab/experiments/<experiment-id>/exports/review-json-comparison.md

adl guidance draft \
  --comparison cmp_docs_visible_vs_prompt_only_vs_test_first \
  --out .agent-lab/experiments/<experiment-id>/exports/review-json-guidance.md

adl export --format svg \
  --out .agent-lab/experiments/<experiment-id>/exports/review-json-tree.svg
adl export --format html \
  --out .agent-lab/experiments/<experiment-id>/exports/review-json-report.html
adl export --format markdown \
  --out .agent-lab/experiments/<experiment-id>/exports/review-json-report.md
adl export --format json \
  --out .agent-lab/experiments/<experiment-id>/exports/review-json-export.json
```

## Observations From The Live Run

All three workers implemented the same core behavior:

```text
script diff: +8/-2
full test suite: pass
```

The difference was mainly in proof style:

| Variant | Test diff | Observed behavior |
| --- | ---: | --- |
| `docs-visible` | `+33` | Smallest proof; used `npm --silent` package-script smoke. |
| `prompt-only` | `+53` | Focused tests; highlighted that plain `npm run` can print lifecycle banners. |
| `test-first` | `+96/-1` | Strongest isolation; created a temporary git repo and captured red/green flow. |

No scored winner was selected. The comparison intentionally remained
qualitative so a human or later LLM reviewer can decide which proof style best
matches the project goal.

## Expected Visual Shape

The generated SVG/HTML report should show this decision tree:

```text
Experiment
+-- Decision: Choose agent collaboration strategy
    +-- Savepoint: Before review JSON task
        +-- Variant: docs-visible
        +-- Variant: prompt-only
        +-- Variant: test-first
```

The exported tree should also show artifacts, evaluations, comparison, and
guidance nodes once those records exist.

## Privacy Boundary

Keep the raw `.agent-lab/` directory in the target workspace unless the
experiment is intentionally public.

Default exports redact local filesystem paths such as `<worktree-root>` to
`[REDACTED_LOCAL_PATH]`. Use `--include-private` and `--no-redact` only for
private local analysis.

Before sharing an export, check:

```bash
rg "/Users|/home|/private/tmp|Bearer|api_key|password" .agent-lab/experiments/<experiment-id>/exports
```

The command should return no private local paths or secrets in public exports.
