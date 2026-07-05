# Security and Privacy

## Core Privacy Principle

Agent Decision Lab is an open-source tool for private experiments.

The tool repository must not contain real experiment data. The user workspace
owns all transcripts, prompts, outputs, paths, artifacts, and evaluation notes.

## Sensitive Data

Experiment records may contain:

- non-public prompts;
- model responses;
- copied code snippets;
- non-public file paths;
- Git remotes;
- issue or ticket identifiers;
- organization-specific guidance;
- security findings;
- command output;
- test logs;
- personal names or reviewer notes.

Treat all experiment records as private unless explicitly sanitized.

## Default Behavior

The CLI should:

- store data locally;
- avoid automatic network upload;
- avoid automatic push;
- warn before exporting full transcripts;
- provide redaction before shareable exports;
- make privacy choices visible in metadata.

## Storage Guidance

Use `.agent-lab/` for experiment metadata in the target workspace.

The project should decide whether to track or ignore `.agent-lab/` per
experiment. A likely pattern is:

```gitignore
.agent-lab/events.jsonl
.agent-lab/**/events.jsonl
.agent-lab/**/transcripts/
.agent-lab/**/exports/private/
```

Less sensitive files such as sanitized summaries may be committed if the user
chooses.

## Redaction

Redaction should be best-effort and explicit. It is not permission to store
secrets carelessly.

The first implementation should redact common forms:

- API keys;
- bearer tokens;
- private keys;
- cookie headers;
- password assignments;
- OAuth client secrets;
- kubeconfig-like blocks;
- common cloud credential keys.

Every export should record:

- whether redaction ran;
- which redaction profile was used;
- whether full event bodies are included;
- whether private fields were omitted.

## Git Safety

The CLI must not:

- force-push;
- delete branches by default;
- delete worktrees by default;
- rewrite user commits by default;
- commit private transcripts automatically without explicit user intent.

Branch and worktree operations should fail closed when the CLI cannot determine
the current state safely.

## Agent Safety

Prompt text and model output are untrusted inputs.

The CLI should not execute model-suggested commands. If future adapters support
command capture, they should record what happened but not grant extra authority
to the model.

## Open-Source Boundary

Public examples must use toy repositories and synthetic transcripts. They must
not reference real organizations, non-public projects, private Git remotes, or
real security incidents.

Sanitized examples may describe a real live run only after replacing local
workspace paths, worktree paths, raw transcripts, and private artifacts with
generic placeholders. Default exports should redact home-directory and temporary
directory paths to `[REDACTED_LOCAL_PATH]`.
