# Release Readiness

This checklist defines the current release gate for Agent Decision Lab.

The goal is not to prove that every future adapter exists. The gate proves that
the local-first CLI is safe enough to publish as an MVP for private,
bring-your-own-agent case studies.

## Verification Command

Run the single release gate before tagging or publishing:

```bash
npm run verify
```

The command runs:

- `npm test`;
- `npm run smoke`;
- `git diff --check`;
- `npm pack --dry-run`.

GitHub Actions runs the same command on pushes to `main` and pull requests.

## Functional Gates

Before release, verify that the CLI supports:

- production onboarding checks with `adl doctor`;
- checkout orientation with `adl whereami`;
- realtime local UI controls with `adl ui`;
- guided workflow commands:
  - `adl lab start`;
  - `adl orchestrate`;
  - `adl rebuild init`;
  - `adl run --quiet`;
  - `adl run --tail`;
- provider-neutral adapter/plugin recipe commands:
  - `adl adapter list`;
  - `adl adapter show`;
  - `adl adapter scaffold`;
  - `adl plugin scaffold`;
- case-study workflow commands:
  - `adl case-study init`;
  - `adl case-study add-variant`;
  - `adl case-study record-result`;
  - `adl case-study export`;
- qualitative `--no-score` evaluations with strengths, weaknesses, and
  evidence;
- comparison output that says no winner selected when evidence is qualitative;
- a recommended next experiment in qualitative comparisons and guidance;
- worktree lifecycle commands:
  - `adl worktree list`;
  - `adl worktree status`;
  - `adl worktree cleanup --dry-run`;
- dashboard-style HTML export with:
  - decision tree;
  - variant table;
  - artifacts;
  - command runs and tests;
  - qualitative findings;
  - privacy/redaction status;
  - export freshness.
- bounded insight export with `adl insight export`;
- public-sharing preflight with `adl privacy audit`;
- local recorder-only MCP server startup with `adl mcp serve`.

## Privacy Gates

Default exports must be safe to inspect and share within the intended private
workspace:

- event bodies are summarized unless `--include-private` is passed;
- local filesystem paths are redacted by default;
- home-directory paths and temporary worktree paths render as
  `[REDACTED_LOCAL_PATH]`;
- public examples use sanitized paths and do not include raw transcripts;
- private `.agent-lab/` experiment data is not committed to this repository.

Before sharing an export, run the built-in audit:

```bash
adl privacy audit --path .agent-lab/experiments/<experiment-id>/exports
```

For a raw backup check, scan for common strings:

```bash
rg "/Users|/home|/private/tmp|Bearer|api_key|password" .agent-lab/experiments/<experiment-id>/exports
```

The scan should not return real local filesystem paths or secrets from public
exports.

## Live Case Study Gates

The MVP has been validated by live private case studies. A release candidate
should keep evidence that:

- one case study exercised multi-agent and multi-worktree development;
- one case study exercised the productized case-study workflow;
- one case study exercised a public Reality Slap Skill target checkout without
  committing private target-local `.agent-lab/` data;
- no-score comparison behaved as qualitative analysis, not a zero-score ranking;
- worktree lifecycle commands could list and dry-run cleanup registered
  worktrees;
- dashboard-style HTML export included the expected analysis surfaces.

Do not commit raw live-case artifacts unless the target project and transcript
are intentionally public and sanitized.

## Release Steps

1. Confirm `git status --short` has no unexpected source or documentation
   changes.
2. Confirm private `.agent-lab/` data is untracked or intentionally ignored.
3. Run `npm run verify`.
4. Review `npm pack --dry-run` output for unexpected files.
5. Update release notes or changelog if the release is public.
6. Tag the release only after the above gates pass.
