import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixtureUsers = JSON.parse(readFileSync(new URL('../fixture-users.json', import.meta.url), 'utf8'));

// This handler exists only in the loopback native-test proxy, outside Laravel.
export function fixtureSession(runtime, incoming, outgoing) {
  const url = new URL(incoming.url ?? '/', 'https://127.0.0.1:9443');
  if (url.pathname !== '/__native_fixture/session') return false;
  outgoing.setHeader('Cache-Control', 'no-store, private');
  outgoing.setHeader('Pragma', 'no-cache');
  outgoing.setHeader('Content-Type', 'application/json');
  const access = JSON.parse(readFileSync(path.join(runtime, 'access.json'), 'utf8'));
  const presented = incoming.headers['x-native-fixture-key'];
  const expected = Buffer.from(access.key, 'utf8');
  const actual = typeof presented === 'string' ? Buffer.from(presented, 'utf8') : Buffer.alloc(0);
  const allowed = incoming.method === 'GET'
    && incoming.socket.remoteAddress === '127.0.0.1'
    && incoming.headers.origin === undefined
    && actual.length === expected.length
    && timingSafeEqual(actual, expected);
  if (!allowed) {
    outgoing.writeHead(403);
    outgoing.end(JSON.stringify({ message: 'Local fixture session access denied.' }));
    return true;
  }
  const fixture = JSON.parse(readFileSync(path.join(runtime, 'fixture.json'), 'utf8'));
  const name = url.searchParams.get('user');
  if (!Object.hasOwn(fixtureUsers, name)) {
    outgoing.writeHead(422);
    outgoing.end(JSON.stringify({ message: 'Choose a seeded local fixture user.' }));
    return true;
  }
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL'].flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []));
  const result = spawnSync('php', [fileURLToPath(new URL('./provision-session.php', import.meta.url)), name], { env, encoding: 'utf8', timeout: 15000 });
  let session;
  try { session = JSON.parse(result.stdout); } catch { /* Only sanitized failures leave this test handler. */ }
  if (result.status !== 0 || ![200, 410, 422].includes(session?.status) || session.status === 200 && typeof session.token !== 'string') {
    outgoing.writeHead(503);
    outgoing.end(JSON.stringify({ message: 'Local fixture session provisioning failed.' }));
  } else if (session.status !== 200) {
    outgoing.writeHead(session.status);
    outgoing.end(JSON.stringify({ message: 'The seeded local account is unavailable. Reset the fixture to restore it.' }));
  } else {
    outgoing.writeHead(200);
    outgoing.end(JSON.stringify({ origin: fixture.origin, token: session.token }));
  }
  return true;
}
