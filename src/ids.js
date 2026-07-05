import { randomUUID } from 'node:crypto';

export function slugify(value) {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return slug || 'untitled';
}

export function makeExperimentId(title, now = new Date()) {
  return `exp_${dateStamp(now)}_${slugify(title)}`;
}

export function makeNodeId(prefix, value) {
  return `${prefix}_${slugify(value)}`;
}

export function makeEventId(now = new Date()) {
  const timestamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `evt_${timestamp}_${randomUUID().slice(0, 8)}`;
}

function dateStamp(now) {
  return now.toISOString().slice(0, 10).replaceAll('-', '');
}
