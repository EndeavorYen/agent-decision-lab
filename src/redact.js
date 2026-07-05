const redactions = [
  {
    pattern: /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
  {
    pattern: /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
    replacement: 'Bearer [REDACTED_TOKEN]',
  },
  {
    pattern: /(authorization\s*:\s*)(basic|bearer)\s+[^\s]+/gi,
    replacement: '$1[REDACTED_AUTHORIZATION]',
  },
  {
    pattern: /(cookie\s*:\s*).+$/gim,
    replacement: '$1[REDACTED_COOKIE]',
  },
  {
    pattern: /\b(password|api[_-]?key|access[_-]?key|secret[_-]?key|client[_-]?secret)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
    replacement: '$1=[REDACTED_SECRET]',
  },
  {
    pattern: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: '[REDACTED_AWS_ACCESS_KEY]',
  },
  {
    pattern: /(^|[\s("'=])((?:\/Users\/[^/\s"'`<>),;]+|\/home\/[^/\s"'`<>),;]+|\/private\/tmp|\/tmp|\/var\/folders)\/[^\s"'`<>),;]*)/g,
    replacement: '$1[REDACTED_LOCAL_PATH]',
  },
  {
    pattern: /(^|[\s("'=])([A-Za-z]:\\Users\\[^\\\s"'`<>),;]+\\[^\s"'`<>),;]*)/g,
    replacement: '$1[REDACTED_LOCAL_PATH]',
  },
];

export function redactText(value) {
  let result = String(value ?? '');
  for (const redaction of redactions) {
    result = result.replace(redaction.pattern, redaction.replacement);
  }
  return result;
}
