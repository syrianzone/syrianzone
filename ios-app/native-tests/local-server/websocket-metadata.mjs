import { chmodSync, closeSync, constants, existsSync, fchmodSync, fstatSync, lstatSync, mkdirSync, openSync, writeSync } from 'node:fs';
import path from 'node:path';

const headerLimit = 16 * 1024;
const logLimit = 1024 * 1024;
const fields = ['timestamp', 'originPresent', 'origin', 'upgrade', 'protocolsOffered', 'upstreamStatus', 'upstreamUpgrade', 'protocolsAccepted'];
function header(headers, name) {
  const entries = Object.entries(headers).filter(([key]) => key.toLowerCase() === name);
  return entries.length === 0 ? undefined : entries.length === 1 ? entries[0][1] : [];
}
function originValue(value) {
  if (value === undefined) return null;
  if (value === 'null') return 'null';
  if (typeof value !== 'string' || value.length > 512) return 'malformed';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value ? value : 'malformed';
  } catch { return 'malformed'; }
}
function upgradeValue(value) {
  return value === undefined ? null : typeof value === 'string' && value.toLowerCase() === 'websocket' ? 'websocket' : 'invalid';
}
function protocols(value) {
  if (value === undefined) return [];
  if (typeof value !== 'string' || value.length > 1024) return ['malformed'];
  const tokens = value.split(',').map((token) => token.trim());
  if (tokens.length > 8 || tokens.some((token) => !/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/.test(token))) return ['malformed'];
  // Only public Pusher protocol names are retained. Arbitrary header tokens
  // could contain credentials, so unknown values are represented by a tag.
  return tokens.map((token) => /^pusher-channels-protocol-[1-9][0-9]{0,2}$/.test(token) ? token : 'other');
}
export function sanitizeHandshakeRequest(headers) {
  const origin = header(headers, 'origin');
  return { originPresent: origin !== undefined, origin: originValue(origin), upgrade: upgradeValue(header(headers, 'upgrade')), protocolsOffered: protocols(header(headers, 'sec-websocket-protocol')) };
}

export function createHandshakeCapture(headers, record, now = () => new Date()) {
  const request = sanitizeHandshakeRequest(headers);
  const timestamp = now().toISOString();
  let buffered = Buffer.alloc(0), finished = false;
  const publish = (upstreamStatus = null, response = {}) => {
    if (finished) return;
    finished = true; buffered = Buffer.alloc(0);
    // Diagnostics must never change socket forwarding or service availability.
    try { record({ timestamp, ...request, upstreamStatus, upstreamUpgrade: upgradeValue(header(response, 'upgrade')), protocolsAccepted: protocols(header(response, 'sec-websocket-protocol')) }); } catch { /* Leave transport untouched if private diagnostics are unavailable. */ }
  };
  return {
    data(chunk) {
      if (finished) return;
      buffered = Buffer.concat([buffered, chunk.subarray(0, headerLimit - buffered.length)]);
      const end = buffered.indexOf('\r\n\r\n');
      if (end < 0) { if (buffered.length === headerLimit) publish(); return; }
      const lines = buffered.subarray(0, end).toString('latin1').split('\r\n');
      const match = /^HTTP\/1\.[01] ([1-5][0-9]{2})(?: [\x20-\x7e]*)?$/.exec(lines.shift() ?? '');
      if (!match) { publish(); return; }
      const response = {};
      for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon < 1) continue;
        const name = line.slice(0, colon).toLowerCase();
        if (!['upgrade', 'sec-websocket-protocol'].includes(name)) continue;
        const value = line.slice(colon + 1).trim();
        response[name] = response[name] === undefined ? value : `${response[name]},${value}`;
      }
      publish(Number(match[1]), response);
    },
    finish() { publish(); },
  };
}

export function createHandshakeLog(directory) {
  if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) throw new Error('Refusing a symlink for private WebSocket diagnostics.');
  mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
  const file = path.join(directory, 'websocket-handshake.jsonl');
  return (metadata) => {
    const safe = Object.fromEntries(fields.filter((key) => Object.hasOwn(metadata, key)).map((key) => [key, metadata[key]]));
    const line = Buffer.from(JSON.stringify(safe) + '\n');
    if (line.length > 4096) return;
    const descriptor = openSync(file, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
    try {
      const stat = fstatSync(descriptor);
      if (!stat.isFile() || stat.size + line.length > logLimit) return;
      fchmodSync(descriptor, 0o600); writeSync(descriptor, line);
    } finally { closeSync(descriptor); }
  };
}
