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

The Agent Decision Lab tool repository ignores raw `.agent-lab/` data by
default:

```gitignore
.agent-lab/
```

Target repositories may choose a stricter or looser policy, but the recommended
default is to keep raw experiment state private and share only redacted exports.
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

The CLI should not execute model-suggested commands. The v0.1.0 adapter/plugin
surface is a provider-neutral recipe layer: it can scaffold local instructions
and record command output through `adl run`, but it does not grant extra
authority to the model. Future executable adapters must preserve that boundary.

## Open-Source Boundary

Public examples must use toy repositories and synthetic transcripts. They must
not reference real organizations, non-public projects, private Git remotes, or
real security incidents.

Sanitized examples may describe a real live run only after replacing local
workspace paths, worktree paths, raw transcripts, and private artifacts with
generic placeholders. Default exports should redact home-directory and temporary
directory paths to `[REDACTED_LOCAL_PATH]`.

## Privacy Audit

Run a privacy audit before sharing reports, committing examples, publishing a
release, or attaching exported artifacts to external systems:

```bash
adl privacy audit --path .agent-lab/exports
adl privacy audit --public-files
adl privacy audit --blocklist .agent-lab/privacy-blocklist.txt --json
```

The audit separates findings by severity:

- `fail`: likely secrets, direct private identifiers, or configured blocklist
  terms;
- `warn`: local absolute paths or other disclosure risks;
- `ok`: no findings.

Fail-severity findings return a non-zero exit code. Local blocklists live in
the private workspace and should not be required in the public tool repository.

## MCP Safety

The MCP adapter is local-first and recorder-only. Its first version does not
execute arbitrary shell commands, call model providers, edit target code,
commit, push, merge, or upload private lab data. MCP tools should return event
ids and summaries, not raw private transcripts by default.
