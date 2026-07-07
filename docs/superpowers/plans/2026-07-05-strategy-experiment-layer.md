# Strategy Experiment Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Agent Decision Lab production-usable for strategy experiments with forkable savepoints, clean branches, comparison reports, Mermaid visualization, guidance drafts, review, and live validation.

**Architecture:** Extend the existing dependency-free Node.js ESM CLI. Keep durable state in focused JSON directories under `.agent-lab/experiments/<id>/`: `savepoints/`, `strategies/`, `rubrics/`, `evaluations/`, and `comparisons/`. Keep events append-only and render JSON, Markdown, Mermaid, and guidance artifacts from the same store.

**Tech Stack:** Node.js 22+, ESM JavaScript, `node:test`, Git CLI, JSON, JSONL, Markdown, Mermaid text export.

## Global Constraints

- Decision point is a question, not a Git anchor.
- Savepoint is the clean Git anchor for repeatable forks.
- Variant must reference the savepoint it came from.
- Starting a new variant from an old savepoint must never rewrite or delete an existing path.
- Visualization must show decision points, savepoints, variants, artifacts, evaluations, comparisons, and guidance as distinct node types.
- Comparison reports must cite the savepoint and strategy for each variant.
- Guidance drafts must be framed as evidence-backed recommendations, not universal truth.
- Do not invoke agents directly in this layer.
- Do not store private project guidance content in this repository.
- Write failing tests before production code.

---

### Task 1: Savepoint Store and Clean Forking

**Files:**
- Modify: `src/store.js`
- Modify: `src/git.js`
- Modify: `src/cli.js`
- Test: `tests/savepoint.test.js`

**Interfaces:**
- Produces: `createSavepoint(repoPath, input): Promise<SavepointRecord>`
- Produces: `startVariant(repoPath, input)` with `from` / `savepointId` support
- Produces: `loadCurrentStore(repoPath).savepoints`

- [ ] **Step 1: Write failing savepoint tests**

Create `tests/savepoint.test.js` with tests that create a decision, create `Read project guidance?`, fork `guidance-visible`, `prompt-only`, and `draft-then-compare` from the same savepoint, and assert all variant `baseCommit` values match the savepoint commit.

- [ ] **Step 2: Verify red**

Run: `node --test tests/savepoint.test.js`
Expected: fail because `createSavepoint` does not exist.

- [ ] **Step 3: Implement savepoint storage and CLI**

Add `.agent-lab/experiments/<id>/savepoints/`, create savepoint tree nodes, reject dirty forkable savepoints, and add `adl savepoint create`.

- [ ] **Step 4: Verify green**

Run: `node --test tests/savepoint.test.js`
Expected: pass.

---

### Task 2: Strategy, Artifact, Rubric, and Evaluation Records

**Files:**
- Create: `src/strategy.js`
- Modify: `src/store.js`
- Modify: `src/cli.js`
- Test: `tests/strategy.test.js`

**Interfaces:**
- Produces: `setStrategy(repoPath, input): Promise<StrategyRecord>`
- Produces: `addArtifact(repoPath, input): Promise<ArtifactRecord>`
- Produces: `evaluateVariant(repoPath, input): Promise<EvaluationRecord>`
- Produces: `loadCurrentStore(repoPath).strategies/rubrics/evaluations`

- [ ] **Step 1: Write failing strategy tests**

Create tests for `strategy set`, `artifact add`, and `evaluate` with code-review-rule-quality scores.

- [ ] **Step 2: Verify red**

Run: `node --test tests/strategy.test.js`
Expected: fail because `src/strategy.js` does not exist.

- [ ] **Step 3: Implement records and CLI**

Add strategy, artifact, rubric, and evaluation JSON records. Add CLI commands `strategy set`, `artifact add`, and `evaluate`.

- [ ] **Step 4: Verify green**

Run: `node --test tests/strategy.test.js`
Expected: pass.

---

### Task 3: Context A/B Template

**Files:**
- Create: `src/templates.js`
- Modify: `src/cli.js`
- Test: `tests/template.test.js`

**Interfaces:**
- Produces: `createContextAbTemplate(repoPath, input): Promise<TemplateResult>`

- [ ] **Step 1: Write failing template tests**

Test `context-ab` creates one decision, one clean savepoint, at least two strategy records, and optional third branch metadata for delayed guidance when requested.

- [ ] **Step 2: Verify red**

Run: `node --test tests/template.test.js`
Expected: fail because `src/templates.js` does not exist.

- [ ] **Step 3: Implement template**

Add `adl template context-ab --question ... --decision ... --a ... --b ... [--c ...]` using savepoint and strategy APIs.

- [ ] **Step 4: Verify green**

Run: `node --test tests/template.test.js`
Expected: pass.

---

### Task 4: Comparison Report and Guidance Draft

**Files:**
- Create: `src/compare.js`
- Create: `src/guidance.js`
- Modify: `src/cli.js`
- Test: `tests/compare.test.js`

**Interfaces:**
- Produces: `compareVariants(repoPath, input): Promise<ComparisonRecord>`
- Produces: `renderComparisonMarkdown(store, comparison): string`
- Produces: `draftGuidance(repoPath, input): Promise<string>`

- [ ] **Step 1: Write failing comparison tests**

Test side-by-side strategy summaries, score table, warnings for missing evidence, winner/inconclusive judgment, and guidance recommendation labels.

- [ ] **Step 2: Verify red**

Run: `node --test tests/compare.test.js`
Expected: fail because compare/guidance modules do not exist.

- [ ] **Step 3: Implement comparison and guidance**

Add `adl compare ... --out ...` and `adl guidance draft --out ...`. Keep synthesis deterministic and conservative.

- [ ] **Step 4: Verify green**

Run: `node --test tests/compare.test.js`
Expected: pass.

---

### Task 5: Mermaid Visualization and Export Integration

**Files:**
- Create: `src/graph.js`
- Modify: `src/export.js`
- Modify: `src/render.js`
- Test: `tests/visualization.test.js`

**Interfaces:**
- Produces: `buildGraphModel(store): GraphModel`
- Produces: `renderMermaid(repoPath): Promise<string>`
- Extends: `exportExperiment(repoPath, { format: 'mermaid' })`

- [ ] **Step 1: Write failing visualization tests**

Test Mermaid output includes experiment, decision diamond, savepoint node, three variants, artifacts, evaluations, comparison, and guidance nodes.

- [ ] **Step 2: Verify red**

Run: `node --test tests/visualization.test.js`
Expected: fail because graph/Mermaid export does not exist.

- [ ] **Step 3: Implement graph model and Mermaid export**

Add graph model, Mermaid renderer, `adl export --format mermaid`, and include savepoints in text tree.

- [ ] **Step 4: Verify green**

Run: `node --test tests/visualization.test.js`
Expected: pass.

---

### Task 6: Production Hardening, Review, and Live Smoke

**Files:**
- Modify: `tests/smoke-runner.mjs`
- Modify: `README.md`
- Modify: `docs/handoff.md`
- Modify: `docs/testing-strategy.md`
- Test: `tests/cli-smoke.test.js`

**Interfaces:**
- Produces: live strategy smoke that creates `Read project guidance?`, forks three branches, evaluates outputs, compares, exports Mermaid, and drafts guidance.

- [ ] **Step 1: Write failing live smoke assertions**

Update smoke tests so they assert savepoint forking, three strategy variants, comparison report, Mermaid tree, and guidance draft.

- [ ] **Step 2: Verify red or partial failure**

Run: `npm test`
Expected: fail until all CLI commands are wired.

- [ ] **Step 3: Finish CLI help/docs and smoke runner**

Update command help, README quickstart, handoff, and testing docs.

- [ ] **Step 4: Verify automated tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Verify live strategy smoke**

Run: `npm run smoke`
Expected: live synthetic strategy experiment passes.

- [ ] **Step 6: Review**

Run a code-review pass over the full diff against `origin/main`, fix Critical and Important findings, and rerun verification.

- [ ] **Step 7: Package and Git verification**

Run: `env npm_config_cache=<temp-npm-cache> npm pack --dry-run`
Expected: dry-run succeeds and package excludes private `.agent-lab` data.

Run: `git diff --check`
Expected: no whitespace errors.
