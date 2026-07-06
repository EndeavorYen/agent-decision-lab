# Realtime UI

Agent Decision Lab includes a local realtime UI for operating a lab without
remembering every CLI command.

Start it from a target repository:

```bash
adl ui --host 127.0.0.1 --port 8787
```

The command prints the local URL. The UI stays local to the machine; it does
not upload experiment data.

## Controls

The first UI release supports these operator actions:

- `Init Case Study`: creates an experiment, decision, and savepoint.
- `Add Variant`: creates a variant branch from a savepoint, optionally creates a
  worktree, and records strategy metadata.
- `Log Note`: records a note event, optionally attached to a variant.
- `Export HTML`: writes a redacted HTML export to
  `.agent-lab/exports/ui-report.html`.
- `Refresh`: forces a state reload.

The UI also shows experiment counts, the rendered decision tree, variants and
branches, recent Event Stream entries, `adl doctor` readiness checks, and
privacy/redaction metadata when a lab exists.

## Realtime Model

The browser connects to `/api/events` with `EventSource`. The server sends the
current lab state immediately and then refreshes it once per second. This keeps
the UI dependency-free and works with any local agent or editor workflow.

The API is intentionally small:

```text
GET  /
GET  /api/state
GET  /api/events
POST /api/case-study-init
POST /api/variants
POST /api/log-note
POST /api/export
```

## Safety

The UI does not run arbitrary shell commands. Use `adl run` in the terminal for
command evidence, where the operator can inspect the command before execution.

The UI writes only local `.agent-lab/` metadata and requested export files.
Private prompts, responses, notes, and artifacts stay in the target workspace.

## Live Review Checklist

When reviewing the UI as a user:

- initialize a case study from the UI;
- add a variant from a savepoint;
- log a note and confirm it appears in the Event Stream without refreshing;
- export HTML and inspect the generated path;
- run `adl status` in the terminal to confirm the UI wrote normal lab metadata;
- open a second browser tab and confirm realtime updates appear there too.
