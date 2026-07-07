# Insight Pack Schema

`adl insight export` creates a bounded JSON package for human or LLM review of
strategy outcomes.

```bash
adl insight export --variants docs-visible,prompt-only \
  --out .agent-lab/exports/insight-pack.json
```

Schema version:

```text
agent-decision-lab/insight-pack/v1
```

## Top-Level Fields

- `schemaVersion`: stable schema identifier.
- `privacy`: export mode, redaction state, and whether private bodies are
  included.
- `redaction`: redaction profile and operator-facing notes.
- `experiment`: sanitized experiment id, title, description, and privacy
  metadata.
- `structure`: decision and savepoint records.
- `variants`: selected variants with strategy metadata.
- `timeline`: bounded event timeline. Raw prompt and response bodies are omitted
  by default.
- `commandOutcomes`: command event summaries and exit metadata supplied by
  `adl run`, `adl log command --metadata`, or MCP `record_command`.
- `artifacts`: artifact references with paths redacted by default.
- `evaluations`: selected variant evaluations.
- `comparisons`: comparison rows and judgments.
- `missingEvidenceWarnings`: warnings for variants without evaluation or command
  evidence.

## Privacy Modes

Default mode is redacted:

```json
{
  "privacy": {
    "mode": "redacted",
    "redactionApplied": true,
    "includePrivateBodies": false,
    "rawPromptResponseBodiesIncluded": false
  }
}
```

Use `--include-private` only for local private analysis. Do not attach private
packs to public issues, releases, or pull requests.

## Determinism

The pack omits generation timestamps and sorts event timeline rows by recorded
event time and id. Re-running the export over unchanged metadata should produce
stable review content, aside from upstream metadata that was intentionally
changed before export.
