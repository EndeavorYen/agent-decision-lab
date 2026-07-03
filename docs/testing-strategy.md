# Testing Strategy

## Testing Goals

Agent Decision Lab manages Git state and experiment records. Tests must protect
against data loss, broken metadata, unsafe branch behavior, and privacy
regressions.

The test suite should make the CLI trustworthy before it manages real
experiments.

## Test Layers

### Unit Tests

Cover pure logic:

- slug generation;
- id generation;
- command option parsing;
- schema validation;
- tree construction;
- export rendering;
- redaction rules;
- path normalization;
- metadata migrations.

### Integration Tests

Use temporary Git repositories to verify real behavior:

- initialize an experiment in a clean repo;
- create a decision point;
- create a variant branch;
- create a variant worktree;
- attach an existing branch;
- detect dirty working trees;
- recover status after an interrupted command;
- export a tree after multiple variants.

Integration tests should not require network access.

### Golden File Tests

Use synthetic fixtures to verify stable output:

- Markdown tree rendering;
- JSON export shape;
- comparison table rendering;
- redacted export rendering.

Golden files must not contain real private transcripts or non-public repository
paths.

### Privacy Tests

Verify that redaction and export controls behave as expected:

- token-like strings are redacted in exports;
- private transcript fields can be omitted from summary exports;
- export metadata records whether redaction was applied;
- warnings appear before full transcript export.

### CLI Smoke Tests

Run end-to-end commands against a temporary repo:

```bash
adl init "Smoke Experiment"
adl decision create "Context strategy"
adl variant start prompt-only --decision context-strategy
adl log note "Initial note"
adl checkpoint "First checkpoint"
adl tree
adl export --format json --out export.json
```

The smoke test should assert that the export is valid JSON and references the
created decision, variant, and checkpoint.

## Test Data Policy

All test data must be synthetic.

Do not commit:

- real AI transcripts;
- private prompts;
- organization-specific policy documents;
- non-public repository paths;
- copied code from private targets;
- credentials or token-like examples that are not clearly fake.

Use obvious fake values such as:

```text
fake-token-for-redaction-test
example.invalid
org/example-repo
```

## Manual Validation

Before a release or handoff, run:

```bash
git diff --check
git status --short
```

Once an implementation exists, add the project test command here and run it
before handoff.

## Acceptance Criteria for MVP

The MVP test suite should prove that:

- metadata is valid after every supported CLI command;
- variant branches and worktrees are created without overwriting user work;
- tree rendering matches the stored metadata;
- JSON exports are deterministic;
- redaction can be applied before sharing exports;
- a user can resume an experiment after closing the terminal.
