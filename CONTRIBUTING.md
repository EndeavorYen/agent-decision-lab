# Contributing

Agent Decision Lab accepts generic, synthetic contributions that preserve the
boundary: tool code is open; real experiments remain private.

## Development

Use Node.js 22 or newer. The project has no runtime dependencies.

```bash
npm test
npm run smoke
npm run verify
```

Write a failing test before changing behavior. Git and metadata tests must use
temporary synthetic repositories. Do not commit real transcripts, private
paths, credentials, organization policy, or target-repository code.

Before opening a pull request, run `npm run verify` and include the focused
test command that proves the change.
