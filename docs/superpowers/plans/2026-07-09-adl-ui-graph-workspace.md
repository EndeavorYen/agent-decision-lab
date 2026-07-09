# ADL UI Graph Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a graph-first ADL local UI that makes the operator's current route, selected node, and safe next actions obvious.

**Architecture:** Keep the existing dependency-free Node HTTP server in `src/ui.js`. Extend `/api/state` with small derived route summaries, replace the current form-forward HTML/CSS/JS with a graph workspace layout, and keep the existing API endpoints backward compatible.

**Tech Stack:** Node.js `>=22`, built-in `node:http`, built-in `node:test`, browser-native HTML/CSS/JavaScript, `EventSource`, and the existing ADL store/export/orchestrator modules.

## Global Constraints

- Do not add a frontend framework, build tool, or runtime dependency.
- Keep the UI local-first and dependency-free through `adl ui`.
- Preserve stable regions: `command-bar`, `route-board`, `decision-workspace`, `selected-route`, and `activity-stream`.
- Support safe ADL-owned operations only: initialize a lab, create variants, render prompts, log notes and responses, checkpoint, refresh, and export.
- Do not run arbitrary shell commands, call an LLM, commit, push, open pull requests, or manage remote branches from the UI.
- Public docs and tests must use generic examples only.
- Validate with `npm test`, `npm run smoke`, `git diff --check`, `node bin/adl.js privacy audit --public-files`, and sanitized browser QA.

---

## File Structure

- Modify `src/ui.js`: add route summaries to API state, redesign the inline HTML/CSS/JS, and keep all existing endpoints.
- Modify `tests/ui.test.js`: add contract assertions for graph-first copy, safe action grouping, route summaries, escaping, and interaction IDs.
- Modify `docs/ui.md`: update operator-facing documentation to describe Graph Workspace behavior.
- Modify `docs/design.md`: update the existing UI design section to match the graph-first model.
- Keep visual QA screenshots and temporary scripts outside the repository.

---

### Task 1: Add Graph Workspace UI Contract Tests

**Files:**
- Modify: `tests/ui.test.js`

**Interfaces:**
- Consumes: `createUiServer(repoPath, options)` from `src/ui.js`.
- Produces: test assertions requiring stable Graph Workspace text and state fields.

- [ ] **Step 1: Write the failing test assertions**

Update the first UI test so the HTML contract requires graph-first regions and grouped route actions:

```js
assert.match(html, /Graph Workspace/);
assert.match(html, /Where am I/);
assert.match(html, /Next Safe Actions/);
assert.match(html, /data-region="node-inspector"/);
assert.match(html, /data-action-group="prepare"/);
assert.match(html, /data-action-group="record"/);
assert.match(html, /data-action-group="preserve"/);
assert.match(html, /id="routeMeta"/);
assert.match(html, /id="graphNodes"/);
assert.match(html, /id="noteBody"/);
assert.match(html, /function renderGraph/);
assert.match(html, /function selectRoute/);
```

After the existing `after` state assertions, add API assertions:

```js
assert.equal(Array.isArray(after.routeSummaries), true);
const docsVisible = after.routeSummaries.find((route) => route.name === 'docs-visible');
assert.equal(docsVisible.name, 'docs-visible');
assert.equal(docsVisible.eventCount, 3);
assert.match(docsVisible.location, /worktree|base lab/);
```

- [ ] **Step 2: Run the UI test to verify it fails**

Run:

```bash
node --test tests/ui.test.js
```

Expected: FAIL because `Graph Workspace`, route action groups, `routeSummaries`, or graph helper functions do not exist yet.

- [ ] **Step 3: Commit the failing test only if preserving a red checkpoint is useful**

Normally do not commit the red state. Keep it in the worktree and continue to Task 2.

---

### Task 2: Implement Graph Workspace State And UI

**Files:**
- Modify: `src/ui.js`
- Test: `tests/ui.test.js`

**Interfaces:**
- Consumes: existing `buildState(repoPath)` data from `loadCurrentStore(repoPath)`.
- Produces: `state.routeSummaries: Array<{ id: string, name: string, branch: string, location: string, contextPolicy: string, eventCount: number, checkpointCount: number, responseCount: number }>` and graph-first HTML.

- [ ] **Step 1: Add derived route summaries**

In `buildState`, after loading the store and before returning state, compute route summaries:

```js
const routeSummaries = store.variants.map((variant) => {
  const routeEvents = store.events.filter((event) => event.variantId === variant.id);
  return {
    id: variant.id,
    name: variant.name,
    branch: variant.branch,
    location: variant.worktreePath ? 'worktree' : 'base lab',
    contextPolicy: variant.contextPolicy ?? 'unspecified',
    eventCount: routeEvents.length,
    checkpointCount: routeEvents.filter((event) => event.type === 'checkpoint').length,
    responseCount: routeEvents.filter((event) => event.type === 'response').length,
  };
});
```

Return `routeSummaries` next to `variants`.

- [ ] **Step 2: Replace the HTML shell with graph-first regions**

Keep the same endpoint and script style, but update `renderUiHtml()` to include:

```html
<header class="top" data-region="command-bar">...</header>
<aside class="route-rail" data-region="route-board">...</aside>
<main class="workspace" data-region="decision-workspace">
  <section class="graph-panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">Graph Workspace</p>
        <h2>Where am I?</h2>
      </div>
    </div>
    <div id="graphNodes" class="graph-nodes"></div>
    <pre id="tree" class="tree-source"></pre>
  </section>
</main>
<aside class="inspector" data-region="selected-route" data-region-secondary="node-inspector">
  <div data-region="node-inspector">...</div>
  <section data-action-group="prepare">...</section>
  <section data-action-group="record">...</section>
  <section data-action-group="preserve">...</section>
</aside>
<section class="activity" data-region="activity-stream">...</section>
```

Keep existing IDs used by tests and users: `refresh`, `export`, `message`, `initBtn`, `variantBtn`, `noteBtn`, `promptBtn`, `promptBlock`, `responseBtn`, and `checkpointBtn`.

- [ ] **Step 3: Replace the browser rendering functions**

Keep `esc`, `api`, `setMessage`, `runAction`, and `refresh`. Add or update these client functions:

```js
function routeOptions(routes) { ... }
function selectedRoute() { ... }
function selectRoute(name) { ... }
function renderGraph(state) { ... }
function renderRouteMeta(route) { ... }
function renderRouteRail(state) { ... }
function renderEvents(events) { ... }
```

`renderGraph(state)` should use `state.treeText` for the canonical tree and render route nodes from `state.routeSummaries` as selectable buttons. `selectRoute(name)` should update `routeSelect`, `noteVariant`, active graph node styling, and route metadata.

- [ ] **Step 4: Update CSS tokens and responsive layout**

Use restrained light-mode tokens:

```css
:root {
  --bg:#f4f6f8;
  --panel:#ffffff;
  --ink:#111827;
  --muted:#64748b;
  --line:#d7dde6;
  --accent:#1f5eff;
  --accent-dark:#1748c7;
  --good:#117a55;
  --warn:#9a6200;
  --bad:#b42318;
}
```

Use a desktop grid:

```css
.shell {
  display:grid;
  grid-template-columns:280px minmax(460px,1fr) 380px;
  grid-template-rows:auto minmax(0,1fr) 220px;
  min-height:100vh;
}
```

At `max-width: 900px`, collapse to one column:

```css
.shell {
  grid-template-columns:1fr;
  grid-template-rows:auto;
}
.top,.route-rail,.workspace,.inspector,.activity {
  grid-column:1;
}
```

- [ ] **Step 5: Run the UI test and full unit suite**

Run:

```bash
node --test tests/ui.test.js
npm test
```

Expected: PASS with all UI behavior still working.

- [ ] **Step 6: Commit implementation**

Run:

```bash
git add src/ui.js tests/ui.test.js
git commit -m "feat: redesign UI as graph workspace"
```

---

### Task 3: Update Docs And Run Full Verification

**Files:**
- Modify: `docs/ui.md`
- Modify: `docs/design.md`

**Interfaces:**
- Consumes: graph-first UI behavior from Task 2.
- Produces: documentation that matches the redesigned local UI.

- [ ] **Step 1: Update `docs/ui.md`**

Describe these operator areas:

```markdown
- Command Bar: realtime state, refresh, export, and action result messages.
- Route Rail: experiment metrics, active route, variants, init, and add-variant controls.
- Graph Workspace: central decision tree and route nodes for understanding current position.
- Node Inspector: selected route metadata and safe next actions.
- Activity Stream: recent notes, responses, checkpoints, and other events.
```

Keep the existing endpoint list and safety section. Add that the UI only runs safe ADL metadata operations.

- [ ] **Step 2: Update `docs/design.md`**

Find the `adl ui` design section and revise it to describe the graph-first control model, existing endpoints, and the no-arbitrary-command safety boundary.

- [ ] **Step 3: Run documentation and privacy checks**

Run:

```bash
git diff --check
node bin/adl.js privacy audit --public-files
```

Expected: both pass with no privacy findings.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test
npm run smoke
git diff --check
node bin/adl.js privacy audit --public-files
npm pack --dry-run
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit docs**

Run:

```bash
git add docs/ui.md docs/design.md
git commit -m "docs: document graph workspace UI"
```

---

### Task 4: Sanitized Browser QA With chrome-cdp-ex

**Files:**
- No repository files should be modified.
- Temporary screenshots and scripts must stay under `/tmp`.

**Interfaces:**
- Consumes: `node bin/adl.js ui --host 127.0.0.1 --port <port>`.
- Produces: visual QA notes for desktop and mobile using generic demo data.

- [ ] **Step 1: Create a sanitized temporary demo lab**

Run outside the repository:

```bash
demo=$(mktemp -d /tmp/adl-ui-demo-XXXXXX)
ADL_REPO=/path/to/agent-decision-lab
cd "$demo"
git init
git config user.name "ADL Demo"
git config user.email "adl-demo@example.invalid"
printf 'demo\n' > README.md
git add README.md
git commit -m "demo: initial"
node "$ADL_REPO/bin/adl.js" lab start "UI Demo Lab" --variants guidance-visible,prompt-only
```

- [ ] **Step 2: Start the ADL UI server**

Run:

```bash
cd "$demo"
node "$ADL_REPO/bin/adl.js" ui --host 127.0.0.1 --port 8788
```

Keep the server running only for QA.

- [ ] **Step 3: Start a CDP-enabled browser and inspect with chrome-cdp-ex**

Use a local Playwright Chromium binary with remote debugging enabled, then run:

```bash
CDP_PORT=9223 node /tmp/chrome-cdp-ex/skills/chrome-cdp-ex/scripts/cdp.mjs list
CDP_PORT=9223 node /tmp/chrome-cdp-ex/skills/chrome-cdp-ex/scripts/cdp.mjs perceive <target-id>
```

Use generic screenshots only. Save them to `/tmp/adl-ui-graph-desktop.png` and `/tmp/adl-ui-graph-mobile.png`.

- [ ] **Step 4: Verify rendered behavior**

Check:

- page identity is Agent Decision Lab;
- first meaningful screen is not blank;
- graph workspace and node inspector are visible on desktop;
- route actions can render a prompt;
- mobile layout has no horizontal overflow or clipped primary controls;
- console errors are absent or explained.

- [ ] **Step 5: Stop QA processes**

Stop the ADL UI server and CDP browser. Do not commit screenshots.
