# Reality Slap Skill Case Study

This is a sanitized summary of a private Agent Decision Lab case study run
against a local checkout of the public Reality Slap Skill project.

The raw `.agent-lab/` experiment state, target-local paths, worktree paths,
prompts, transcripts, and artifacts stay in the target workspace. This document
records only the reusable shape of the run.

## Decision

Question:

```text
What context should an agent see before improving Reality Slap onboarding
guidance?
```

The savepoint was created before exposing variant-specific context. Each
variant represented a different collaboration strategy:

- `readme-skill-visible`: agent sees public README and runtime skill guidance;
- `eval-evidence-first`: agent sees eval metadata and release-gate evidence
  before drafting guidance;
- `minimal-prompt-only`: agent receives only the task prompt and public command
  surface summary.

## Adapter Usage

The run exercised the provider-neutral adapter/plugin surface:

```bash
adl adapter list
adl adapter scaffold manual --variant readme-skill-visible
adl plugin scaffold command-wrapper --variant eval-evidence-first
```

The generated recipes stayed under the private `.agent-lab/` directory in the
target checkout.

## Evidence Captured

The case study used `adl run` to capture target-side verification evidence, then
recorded qualitative no-score results:

```bash
adl run --variant eval-evidence-first -- python3 scripts/check_release_ready.py --dry-run

adl case-study record-result eval-evidence-first \
  --strengths "anchors onboarding in release evidence and eval roles" \
  --weaknesses "heavier context for simple contributor tasks" \
  --evidence "release-gate dry run recorded as command evidence" \
  --no-score
```

No-score mode was intentional. The useful output is a human or later LLM review
of tradeoffs, not a premature numeric winner.

## Export Pack

The private run exported:

- `comparison.md`;
- `guidance.md`;
- `tree.svg`;
- `report.html`;
- `report.md`;
- `export.json`.

The exported report was redacted and privacy-scanned for local paths and
secrets before this summary was written. Public documentation describes the
flow but does not embed raw transcripts or target-local artifact content.

## Guidance Outcome

The strongest reusable guidance was:

- use README and SKILL context when changing user-facing onboarding;
- use eval evidence first when changing release gates, scoring, or claims about
  skill quality;
- use prompt-only runs as a control, not as the primary authoring path, when
  the target project already has high-signal release evidence.

Recommended next experiment:

```text
Compare whether adapter recipes should be scaffolded before or after variant
creation, then inspect whether the agent records cleaner evidence when the
adapter recipe is visible from the start.
```
