import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/args.js';

test('parses nested command, options, positionals, and boolean flags', () => {
  const parsed = parseArgs([
    'decision',
    'create',
    'Context strategy',
    '--rationale',
    'Compare context policies',
    '--json',
  ]);

  assert.deepEqual(parsed.command, ['decision', 'create']);
  assert.deepEqual(parsed.positionals, ['Context strategy']);
  assert.equal(parsed.options.rationale, 'Compare context policies');
  assert.equal(parsed.options.json, true);
});

test('parses stdin flag and leaves log body as a positional', () => {
  const parsed = parseArgs(['log', 'note', 'Design approved', '--stdin']);

  assert.deepEqual(parsed.command, ['log', 'note']);
  assert.deepEqual(parsed.positionals, ['Design approved']);
  assert.equal(parsed.options.stdin, true);
});

test('parses command arguments after a delimiter as positionals', () => {
  const parsed = parseArgs([
    'run',
    '--variant',
    'prompt-only',
    '--',
    'node',
    '-e',
    'console.log("ok")',
  ]);

  assert.deepEqual(parsed.command, ['run']);
  assert.equal(parsed.options.variant, 'prompt-only');
  assert.deepEqual(parsed.positionals, ['node', '-e', 'console.log("ok")']);
});
