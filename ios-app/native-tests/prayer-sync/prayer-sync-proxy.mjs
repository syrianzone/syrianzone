import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const endpoint = '/__native_fixture/prayer-sync';
const origin = 'https://127.0.0.1:9443';
const commandFile = fileURLToPath(new URL('./prayer-sync-command.php', import.meta.url));

export function parsePrayerCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Closed Prayer command required.');
  const { nonce, day, action, index } = value;
  const withIndex = action === 'intent' || action === 'checkpoint';
  const keys = withIndex ? ['nonce', 'day', 'action', 'index'] : ['nonce', 'day', 'action'];
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
    || !/^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/.test(nonce ?? '')
    || typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)
    || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day
    || !['arm', 'context', 'intent', 'checkpoint', 'restore', 'close'].includes(action)
    || (withIndex && (!Number.isInteger(index) || index < 1 || index > 5))) throw new Error('Closed Prayer command refused.');
  return { nonce, day, action, ...(withIndex ? { index } : {}) };
}


function closedContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'appearance101,appearance102,home101,home102,seed102,version'
    || value.version !== 2 || typeof value.home101 !== 'string' || !/^[a-f0-9]{64}$/.test(value.home101)
    || typeof value.home102 !== 'string' || !/^[a-f0-9]{64}$/.test(value.home102)
    || !['light', 'dark'].includes(value.appearance101) || !['light', 'dark'].includes(value.appearance102)
    || typeof value.seed102 !== 'boolean') throw new Error('Closed immutable Home context required.');
  return { version: 2, home101: value.home101, home102: value.home102,
    appearance101: value.appearance101, appearance102: value.appearance102, seed102: value.seed102 };
}

// Gated loopback handler. Tests inject both private I/O seams.
export function createPrayerSyncHandler(runtime, {
  readAccess = () => JSON.parse(readFileSync(path.join(runtime, 'access.json'), 'utf8')),
  runCommand = command => {
    const result = spawnSync('php', [commandFile], { input: JSON.stringify(command), encoding: 'utf8', timeout: 20000, maxBuffer: 4096 });
    if (result.status !== 0 || result.error) throw new Error('Prayer command refused.');
    return JSON.parse(result.stdout);
  },
} = {}) {
  return async (incoming, outgoing) => {
    if (incoming.url !== endpoint) return false;
    outgoing.setHeader('Cache-Control', 'no-store, private');
    outgoing.setHeader('Content-Type', 'application/json');
    outgoing.setHeader('X-Native-Prayer-Journal-Version', '2');
    const finish = (status, value) => { outgoing.writeHead(status); outgoing.end(JSON.stringify(value)); return true; };
    try {
      const key = readAccess().key;
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,256}$/.test(key)) return finish(403, { message: 'Local Prayer fixture access denied.' });
      const expected = Buffer.from(key);
      const presented = incoming.headers['x-native-fixture-key'];
      const actual = typeof presented === 'string' ? Buffer.from(presented) : Buffer.alloc(0);
      if (incoming.method !== 'POST' || incoming.socket.remoteAddress !== '127.0.0.1'
        || incoming.headers.host !== new URL(origin).host || incoming.headers.origin !== undefined
        || incoming.headers.authorization !== undefined || incoming.headers.cookie !== undefined
        || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(incoming.headers['content-type'] ?? '')
        || expected.length < 16 || expected.length > 256 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        return finish(403, { message: 'Local Prayer fixture access denied.' });
      }
      let body = '';
      for await (const chunk of incoming) {
        body += chunk.toString('utf8');
        if (Buffer.byteLength(body) > 2048) return finish(413, { message: 'Prayer fixture command is too large.' });
      }
      const command = parsePrayerCommand(JSON.parse(body));
      const result = runCommand(command);
      if (result.journalVersion !== 2 || result.status !== 200 || result.ok !== true || result.nonce !== command.nonce || result.day !== command.day
        || !Number.isInteger(result.phase) || result.phase < 0 || result.phase > 5
        || !(result.pending === null || Number.isInteger(result.pending) && result.pending >= 1 && result.pending <= 5)
        || typeof result.restored !== 'boolean' || typeof result.closed !== 'boolean') {
        return finish(409, { message: 'The bounded Prayer fixture operation was refused.' });
      }
      const context = command.action === 'context' ? closedContext(result.context) : null;
      return finish(200, { journalVersion: 2, ...(context ? { context } : {}), ok: true, nonce: result.nonce, day: result.day, phase: result.phase,
        pending: result.pending, restored: result.restored, closed: result.closed });
    } catch { return finish(409, { message: 'The bounded Prayer fixture operation was refused.' }); }
  };
}
