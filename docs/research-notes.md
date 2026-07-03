# Research Notes

Initial research date: 2026-07-03.

This document records adjacent tools and concepts. Agent Decision Lab should
learn from them, not blindly rebuild them.

## Summary

No single reviewed tool exactly matches the target shape:

> a local-first CLI for interactive decision points, branchable agent-session
> variants, Git worktree isolation, structured experiment tree output, and
> later LLM analysis.

The ecosystem has strong pieces:

- agent workflow checkpointing;
- AI coding session provenance;
- parallel agent branch management;
- evaluation platforms;
- coding workflow orchestrators.

Agent Decision Lab should fill the gap between those pieces.

## Adjacent Tools

### Entire CLI

URL: https://github.com/entireio/cli

Entire captures AI coding sessions, prompts, responses, modified files, and
timestamps, then stores metadata on a separate Git branch. It is close to the
session provenance layer that Agent Decision Lab may want to integrate with.

Difference: Agent Decision Lab is centered on explicit decision trees and
controlled strategy variants, not only checkpointing session metadata.

### LangGraph Time Travel

URL: https://docs.langchain.com/oss/python/langgraph/use-time-travel

LangGraph supports replaying and forking from checkpoints in agent workflows.
This is conceptually close to branching from decision points.

Difference: LangGraph is an agent workflow framework. It does not directly
manage coding worktrees, Git branches, private experiment records, or developer
handoff artifacts.

### DoorDash Agentic Orchestrator

URL: https://github.com/doordash-oss/agentic-orchestrator

Agentic Orchestrator coordinates AI development workflows from feature request
through research, planning, implementation, review, and pull request.

Difference: it is optimized for getting a feature to a reviewable PR. Agent
Decision Lab is optimized for comparing alternative collaboration strategies.

### GitButler Parallel Agents

URL: https://docs.gitbutler.com/ai-agents/parallel-agents

GitButler supports multiple active branches and parallel agent workflows in one
workspace.

Difference: Agent Decision Lab should support explicit experiment trees and
worktree isolation for competing attempts or incompatible runtime state.

### GitHub Agent HQ

URL: GitHub Agent HQ announcement on github.blog

GitHub Agent HQ provides a mission-control style interface for assigning and
tracking multiple coding agents.

Difference: Agent Decision Lab is local-first, model-agnostic, and focused on
experiment metadata that can remain private.

### Evaluation Platforms

Examples:

- OpenAI Evals: https://developers.openai.com/api/docs/guides/evaluation-best-practices
- Braintrust: https://www.braintrust.dev/docs/evaluation-quickstart

These tools can compare model or prompt performance over datasets and scores.

Difference: they do not manage interactive coding-session branches, Git
worktrees, or decision trees. Agent Decision Lab should export data that can be
fed into evaluation tools later.

## Design Implications

- Do not build a full coding agent first.
- Do not build a hosted observability platform first.
- Do not tie the core to one model provider.
- Do make the decision tree and Git isolation first-class.
- Do keep exports structured enough for later evaluation.
- Do make privacy and redaction part of the initial design.
