# Goals

## Mission

Agent Decision Lab helps humans run and compare branching AI development
strategies without losing context, Git state, or evidence.

The product exists to make agent collaboration observable. It should help a
developer answer:

- What strategy did we try?
- What did the agent see?
- Where did the session branch?
- What code, docs, tests, or artifacts did each path produce?
- Which path looks better, and why?

## Product Goals

- Provide a local-first CLI for branching AI development experiments.
- Bind each variant to explicit Git branch and worktree state.
- Record prompts, responses, notes, checkpoints, commands, and artifacts.
- Render a human-readable decision tree.
- Export structured JSON for LLM or data analysis.
- Keep the open-source tool generic and free of private experiment data.
- Make it easy to resume an experiment after a pause.

## Research Goals

- Compare how context visibility changes agent decisions.
- Compare spec-first, test-first, and implementation-first collaboration
  styles.
- Compare outputs from different models or coding agents under the same task.
- Identify which workflow rules produce safer architecture, clearer tests, and
  more maintainable code.
- Build reusable evidence for human-AI software development guidelines.

## Non-Goals

- Decide automatically which branch should merge.
- Replace human engineering judgment.
- Host private transcripts by default.
- Force teams to use one model provider or agent.
- Hide prompts or policy from the human operator.
- Turn private experiments into open-source data.

## First Success Condition

The first successful use of Agent Decision Lab should produce one private
experiment with at least two variants, isolated Git state, recorded prompts and
artifacts, a rendered tree, and an exported JSON file that another LLM can
analyze for differences.
