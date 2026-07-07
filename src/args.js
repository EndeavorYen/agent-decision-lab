const pairedCommands = new Set([
  'adapter',
  'artifact',
  'case-study',
  'decision',
  'experiment',
  'guidance',
  'insight',
  'lab',
  'log',
  'mcp',
  'plugin',
  'privacy',
  'rebuild',
  'savepoint',
  'strategy',
  'template',
  'variant',
  'worktree',
]);

export function parseArgs(argv) {
  const command = [];
  const rest = [...argv];

  if (rest[0] && !rest[0].startsWith('-')) {
    command.push(rest.shift());
    if (pairedCommands.has(command[0]) && rest[0] && !rest[0].startsWith('-')) {
      command.push(rest.shift());
    }
  }

  const options = {};
  const positionals = [];

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === '--') {
      positionals.push(...rest.slice(index + 1));
      break;
    }
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    if (token.startsWith('--no-')) {
      options[toCamel(token.slice(5))] = false;
      continue;
    }

    const equalsIndex = token.indexOf('=');
    if (equalsIndex !== -1) {
      const key = token.slice(2, equalsIndex);
      options[toCamel(key)] = token.slice(equalsIndex + 1);
      continue;
    }

    const key = toCamel(token.slice(2));
    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }

  return { command, options, positionals };
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
