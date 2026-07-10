# Changelog

## 0.2.0 - Unreleased

### Added

- Lab-scoped writer locking and atomic JSON replacement.
- Worktree-aware event attribution.
- Explicit v1-to-v2 metadata migration.
- Git operation journal, doctor diagnostics, and `repair --dry-run` plans.
- Declarative CLI option contracts and typed MCP tool schemas.
- Launch-token, same-origin, and request-size protection for the local UI.

### Changed

- Metadata schema advances to `agent-decision-lab/v2` with aggregate revisions.
- The release gate includes the public-file privacy audit.

### Security

- Local UI mutation and event-stream routes no longer accept unauthenticated
  requests from other local or browser contexts.

## 0.1.0 - 2026-07-05

- Initial local-first CLI release.
