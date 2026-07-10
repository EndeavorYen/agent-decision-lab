# ADL UI Graph Workspace Design

## Summary

Redesign the Agent Decision Lab local UI around a graph-first operator model.
The primary question the UI should answer is: "Where am I in the decision
tree, and what action can I safely take next?"

This replaces the current form-forward layout with a workspace centered on the
decision tree, selected node context, and safe ADL actions. The UI remains a
dependency-free local HTTP app served by `adl ui`.

## Goals

- Make the current experiment, active route, and selected node immediately
  visible.
- Show available next actions from the selected node instead of scattering
  controls across unrelated panels.
- Keep all operations limited to ADL-owned metadata actions: initialize a lab,
  create variants, render prompts, log notes and responses, checkpoint, refresh,
  and export.
- Preserve the stable UI regions used by tests and future automation:
  `command-bar`, `route-board`, `decision-workspace`, `selected-route`, and
  `activity-stream`.
- Improve scanability, keyboard focus, responsive behavior, and visual polish
  without introducing a frontend build system or runtime dependency.
- Keep public docs, tests, and sample data generic and privacy-safe.

## Non-Goals

- Do not run arbitrary shell commands from the UI.
- Do not call an LLM from the UI.
- Do not commit, push, open pull requests, or manage remote branches from the
  UI.
- Do not expose private prompt or response bodies beyond the local `.agent-lab`
  state already owned by the target workspace.
- Do not replace CLI workflows; the UI should make common safe operations more
  discoverable.

## Design Direction

Use a restrained operational console style inspired by Minimalism and Swiss
Style: clear hierarchy, crisp borders, high contrast, dense but readable panels,
and predictable controls. Avoid decorative gradients, neon palettes, heavy
illustration, oversized marketing composition, or card nesting.

The UI should feel like a control room for branching decisions:

- a top command bar for global status and export/refresh;
- a left route rail for experiment summary, active route, and variant list;
- a central graph workspace for decision tree navigation;
- a right inspector for the selected node and its allowed actions;
- a bottom event stream for recent activity.

## Layout

### Command Bar

The command bar remains the global anchor. It shows:

- product name;
- realtime connection state;
- current experiment title or "No lab initialized";
- refresh action;
- export action;
- status message area with success and failure states.

### Route Rail

The route rail answers "What routes exist?"

It contains:

- experiment metrics;
- active variant when available;
- variant list with branch and worktree indicators;
- an init panel when no lab is initialized;
- an add-variant action entry point.

The route rail should use compact rows instead of large cards. Each row should
be selectable in the browser UI even when the underlying CLI route selection is
still represented by a variant name.

### Graph Workspace

The graph workspace answers "Where am I?"

The first implementation may render a structured, code-native tree from the
existing text tree while improving readability. The design should make nodes
feel selectable through layout, indentation, node labels, and active-state
treatment. It should leave room for a future SVG or canvas graph without
changing the API contract.

Required behavior:

- show initialized and uninitialized states clearly;
- highlight the selected route when a variant is selected;
- keep the full tree scrollable without clipping controls;
- avoid horizontal layout shifts when events refresh.

### Node Inspector

The inspector answers "What can I do from here?"

It contains:

- selected route selector;
- selected route metadata;
- prompt rendering;
- response logging;
- checkpoint logging;
- note logging;
- doctor/privacy status summary.

Actions should be grouped by intent:

- Prepare: render orchestrator prompt.
- Record: log response or note.
- Preserve: create checkpoint.
- Share: export a redacted report.

Buttons should be explicit, safe, and local. Textareas and inputs should have
clear labels, stable heights, and visible focus states.

### Activity Stream

The activity stream answers "What just happened?"

It shows recent events in reverse chronological order with:

- event type;
- route or no-route label;
- actor;
- timestamp when available;
- short redacted body summary.

The stream should remain readable at the bottom of desktop layouts and become a
normal full-width section on narrow screens.

## API And Data Flow

Keep the existing endpoints:

```text
GET  /
GET  /api/state
GET  /api/events
POST /api/case-study-init
POST /api/variants
POST /api/log-note
POST /api/log-response
POST /api/checkpoint
POST /api/orchestrate
POST /api/export
```

The browser should continue to use `EventSource` for live updates. Client state
should derive from `/api/state`; no hidden browser-only state should be required
to understand the lab.

Small derived fields may be added to `/api/state` if they reduce fragile
browser parsing, such as route display summaries or event counts by variant.

## Accessibility And Responsiveness

- Use semantic labels for inputs and grouped actions.
- Provide visible focus states for buttons, selects, inputs, and textareas.
- Keep contrast suitable for light-mode operational use.
- Respect reduced-motion preferences.
- Support at least desktop `1440x900`, laptop `1280x800`, tablet `768px`, and
  mobile `390px` widths.
- On mobile, collapse to command bar, route rail, graph workspace, inspector,
  and activity stream in that order.

## Testing

Automated tests should continue to verify:

- stable UI regions are present;
- initialization, variant creation, note logging, prompt rendering, response
  logging, checkpointing, export, and realtime state still work;
- user-provided text is escaped before rendering;
- API errors surface through the status message area.

Rendered UI validation should use a sanitized demo lab with generic names only.
Visual regression should cover:

- first meaningful desktop screen;
- selected route action workflow;
- mobile layout;
- console health and blank-page checks.

## Privacy

Do not commit screenshots, exported reports, local paths, experiment bodies, or
private target repository metadata. Test fixtures and docs must use generic
examples such as `UI Lab`, `docs-visible`, `prompt-only`, and
`draft-then-compare`.

The UI may display local `.agent-lab` metadata at runtime because it is a local
operator tool, but public repo artifacts must stay provider-neutral and
organization-neutral.

## Acceptance Criteria

- The UI opens with a graph-first workspace where the decision tree is the
  central interaction model.
- The selected route has an obvious inspector with next safe actions.
- The existing UI API remains backward compatible.
- All current UI tests pass, with added assertions for graph workspace copy and
  route action grouping.
- `npm test`, `npm run smoke`, `git diff --check`, and
  `node bin/adl.js privacy audit --public-files` pass.
- A sanitized browser run confirms desktop and mobile layouts are readable and
  usable.
