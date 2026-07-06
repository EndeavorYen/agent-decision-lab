import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectRoot, run } from './helpers.js';

const blockedTerms = [
  {
    label: 'legacy internal acronym',
    value: ['s', 'q', 'm'].join(''),
  },
  {
    label: 'personal account handle',
    value: [
      'e',
      'n',
      'd',
      'e',
      'a',
      'v',
      'o',
      'r',
      'i',
      's',
      'f',
      'o',
      'r',
      'e',
      'v',
      'e',
      'r',
    ].join(''),
  },
  {
    label: 'consumer mail domain',
    value: ['g', 'm', 'a', 'i', 'l', '.', 'c', 'o', 'm'].join(''),
  },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('tracked public files do not contain blocked release terms', async () => {
  const files = run('git', ['ls-files'], projectRoot).stdout
    .split('\n')
    .filter(Boolean)
    .filter((path) => !path.endsWith('.png') && !path.endsWith('.jpg'));
  const matches = [];

  for (const file of files) {
    const body = await readFile(join(projectRoot, file), 'utf8');
    for (const term of blockedTerms) {
      const pattern = new RegExp(escapeRegExp(term.value), 'i');
      if (pattern.test(body)) {
        matches.push(`${file}: ${term.label}`);
      }
    }
  }

  assert.deepEqual(matches, []);
});
