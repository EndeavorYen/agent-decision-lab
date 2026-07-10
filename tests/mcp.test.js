import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { adlBin, cleanup, createTempGitRepo, runAdl } from './helpers.js';

test('MCP stdio server lists tools and records events without shell execution', async () => {
  const repo = await createTempGitRepo();
  const server = spawn(process.execPath, [adlBin, 'mcp', 'serve'], {
    cwd: repo,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const client = createJsonLineClient(server);
  try {
    const tools = await client.request('tools/list', {});
    const names = tools.tools.map((tool) => tool.name);
    assert.equal(names.includes('doctor'), true);
    assert.equal(names.includes('status'), true);
    assert.equal(names.includes('whereami'), true);
    assert.equal(names.includes('log_prompt'), true);
    assert.equal(names.includes('record_command'), true);
    assert.equal(names.includes('run_shell'), false);
    assert.equal(tools.tools.every((tool) => tool.inputSchema.additionalProperties === false), true);
    const logNoteTool = tools.tools.find((tool) => tool.name === 'log_note');
    assert.equal(logNoteTool.inputSchema.properties.body.type, 'string');
    assert.deepEqual(logNoteTool.inputSchema.required, ['body']);
    const commandTool = tools.tools.find((tool) => tool.name === 'record_command');
    assert.equal(commandTool.inputSchema.properties.command.type, 'array');
    assert.deepEqual(commandTool.inputSchema.required, ['command']);

    const doctor = await client.request('tools/call', { name: 'doctor', arguments: {} });
    assert.match(doctor.content[0].text, /Git repository/);

    assert.equal(runAdl(repo, ['lab', 'start', 'MCP Lab', '--variants', 'agent-route']).status, 0);

    const status = await client.request('tools/call', { name: 'status', arguments: {} });
    assert.match(status.content[0].text, /MCP Lab/);

    const note = await client.request('tools/call', {
      name: 'log_note',
      arguments: { variant: 'agent-route', body: 'agent recorded note' },
    });
    assert.match(note.content[0].text, /event/);

    const tree = runAdl(repo, ['tree']);
    assert.match(tree.stdout, /agent-route/);
  } finally {
    server.kill('SIGTERM');
    await once(server, 'exit').catch(() => {});
    await cleanup(repo);
  }
});

function createJsonLineClient(server) {
  let nextId = 1;
  let buffer = '';
  const pending = new Map();
  server.stdout.setEncoding('utf8');
  server.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        const message = JSON.parse(line);
        const entry = pending.get(message.id);
        if (entry) {
          pending.delete(message.id);
          if (message.error) {
            entry.reject(new Error(message.error.message));
          } else {
            entry.resolve(message.result);
          }
        }
      }
      newline = buffer.indexOf('\n');
    }
  });
  return {
    request(method, params) {
      const id = nextId;
      nextId += 1;
      const promise = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      return promise;
    },
  };
}
