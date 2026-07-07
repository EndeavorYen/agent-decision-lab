import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { git } from './git.js';

const secretPatterns = [
  /Bearer\s+(?=[A-Za-z0-9._~+/=-]*[0-9._~+/=-])[A-Za-z0-9._~+/=-]{12,}/i,
  /(authorization\s*:\s*)(basic|bearer)\s+[^\s]+/i,
  /-----BEGIN [^-]*PRIVATE KEY-----/i,
  /\b(password|api[_-]?key|access[_-]?key|secret[_-]?key|client[_-]?secret)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/i,
  /\b(AKIA|ASIA)[A-Z0-9]{16}\b/,
];

const localPathPattern = /(^|[\s("'=])((?:\/Users\/[^/\s"'`<>),;]+|\/home\/[^/\s"'`<>),;]+|\/private\/tmp|\/var\/folders)\/[^\s"'`<>),;]*)/;
const emailPattern = /\b[A-Z0-9._%+-]+@(?!example\.invalid\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export async function auditPrivacy(repoPath, options = {}) {
  const files = await filesToScan(repoPath, options);
  const blocklist = await loadBlocklist(repoPath, options.blocklist);
  const findings = [];

  for (const file of files) {
    const body = await readTextIfPossible(file);
    if (body === null) {
      continue;
    }
    const displayPath = relative(repoPath, file) || file;
    scanBody(displayPath, body, blocklist, findings);
    if (/(^|\/)\.env($|\.)|credential|secret/i.test(displayPath)) {
      findings.push(finding('fail', 'credential-file', displayPath, 'credential-like file path under scanned scope'));
    }
  }

  const status = findings.some((item) => item.severity === 'fail')
    ? 'fail'
    : findings.some((item) => item.severity === 'warn') ? 'warn' : 'ok';
  return {
    schemaVersion: 'agent-decision-lab/privacy-audit/v1',
    status,
    scannedFiles: files.length,
    findings,
  };
}

export function formatPrivacyAudit(report) {
  const lines = [
    `Privacy audit: ${report.status}`,
    `Scanned files: ${report.scannedFiles}`,
    '',
  ];
  if (report.findings.length === 0) {
    lines.push('No findings.', '');
    return lines.join('\n');
  }
  for (const item of report.findings) {
    lines.push(`${item.severity}: ${item.kind} ${item.path} - ${item.message}`);
  }
  lines.push('');
  return lines.join('\n');
}

async function filesToScan(repoPath, options) {
  if (options.publicFiles === true) {
    const result = git(repoPath, ['ls-files'], { allowFailure: true });
    if (result.status !== 0) {
      return [];
    }
    return result.stdout
      .split('\n')
      .filter(Boolean)
      .filter((file) => !file.startsWith('tests/'))
      .map((file) => resolve(repoPath, file));
  }

  const target = resolve(repoPath, options.path ?? '.agent-lab/exports');
  return await collectFiles(target);
}

async function collectFiles(path) {
  const info = await stat(path).catch(() => null);
  if (!info) {
    return [];
  }
  if (info.isFile()) {
    return [path];
  }
  if (!info.isDirectory()) {
    return [];
  }
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(child));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files.sort();
}

async function readTextIfPossible(path) {
  try {
    const body = await readFile(path, 'utf8');
    if (body.includes('\u0000')) {
      return null;
    }
    return body;
  } catch {
    return null;
  }
}

async function loadBlocklist(repoPath, blocklistPath) {
  const paths = [
    blocklistPath ? resolve(repoPath, blocklistPath) : null,
    resolve(repoPath, '.agent-lab/privacy-blocklist.txt'),
  ].filter(Boolean);
  for (const path of paths) {
    const body = await readFile(path, 'utf8').catch(() => null);
    if (body !== null) {
      return body
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    }
  }
  return [];
}

function scanBody(path, body, blocklist, findings) {
  for (const pattern of secretPatterns) {
    const match = body.match(pattern);
    if (match && !isSafeExample(match[0])) {
      findings.push(finding('fail', 'secret', path, 'secret-like value detected'));
      break;
    }
  }
  if (localPathPattern.test(body)) {
    findings.push(finding('warn', 'local-path', path, 'local absolute path detected'));
  }
  const emailMatch = body.match(emailPattern);
  if (emailMatch && !isSafeExample(emailMatch[0])) {
    findings.push(finding('fail', 'email-address', path, 'email address detected'));
  }
  for (const term of blocklist) {
    if (body.toLowerCase().includes(term.toLowerCase())) {
      findings.push(finding('fail', 'blocklist', path, 'blocklist term matched'));
    }
  }
}

function finding(severity, kind, path, message) {
  return { severity, kind, path, message };
}

function isSafeExample(value) {
  return /fake-token-for-|example\.invalid|example\.com/i.test(value);
}
