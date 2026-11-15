import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHandshakeCapture, createHandshakeLog, sanitizeHandshakeRequest } from './websocket-metadata.mjs';

test('native missing Origin and exact Pusher subprotocol are represented without unrelated headers', () => {
  const metadata = sanitizeHandshakeRequest({ upgrade: 'websocket', 'sec-websocket-protocol': 'pusher-channels-protocol-7', authorization: 'Bearer private-token', cookie: 'private-cookie', host: 'private-host' });
  assert.deepEqual(metadata, { originPresent: false, origin: null, upgrade: 'websocket', protocolsOffered: ['pusher-channels-protocol-7'] });
  assert.equal(JSON.stringify(metadata).includes('private'), false);
});

test('Origin records only a canonical tuple or safe null/malformed markers', () => {
  assert.equal(sanitizeHandshakeRequest({ origin: 'https://127.0.0.1:9443' }).origin, 'https://127.0.0.1:9443');
  assert.equal(sanitizeHandshakeRequest({ origin: 'null' }).origin, 'null');
  for (const origin of ['https://user:secret@example.invalid', 'https://example.invalid/path?secret=gate', ' https://example.invalid', 'https://example.invalid/', 'https://example.invalid\nCookie: secret', ['https://example.invalid']]) {
    assert.deepEqual(sanitizeHandshakeRequest({ origin }), { originPresent: true, origin: 'malformed', upgrade: null, protocolsOffered: [] });
  }
  assert.equal(sanitizeHandshakeRequest({ upgrade: 'not-a-websocket', 'sec-websocket-protocol': 'secret-gate-token' }).upgrade, 'invalid');
  assert.deepEqual(sanitizeHandshakeRequest({ 'sec-websocket-protocol': 'secret-gate-token' }).protocolsOffered, ['other']);
});

test('fragmented upstream headers emit one bounded metadata record and retain no cookie or payload', () => {
  const records = [];
  const capture = createHandshakeCapture({ origin: 'https://127.0.0.1:9443', upgrade: 'WebSocket' }, (row) => records.push(row), () => new Date('2026-11-14T22:00:00Z'));
  capture.data(Buffer.from('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nSec-WebSocket-Pro'));
  assert.equal(records.length, 0);
  capture.data(Buffer.from('tocol: pusher-channels-protocol-7\r\nSet-Cookie: secret-cookie\r\n\r\nsecret-frame'));
  capture.data(Buffer.from('later-secret-frame')); capture.finish();
  assert.deepEqual(records, [{ timestamp: '2026-11-14T22:00:00.000Z', originPresent: true, origin: 'https://127.0.0.1:9443', upgrade: 'websocket', protocolsOffered: [], upstreamStatus: 101, upstreamUpgrade: 'websocket', protocolsAccepted: ['pusher-channels-protocol-7'] }]);
  assert.equal(JSON.stringify(records).includes('secret'), false);
});

test('rejected or absent upstream handshake records status without response content', () => {
  const rows = [];
  const rejected = createHandshakeCapture({}, (row) => rows.push(row));
  rejected.data(Buffer.from('HTTP/1.1 426 private reason\r\nX-Private: secret\r\n\r\nprivate-body'));
  const disconnected = createHandshakeCapture({}, (row) => rows.push(row)); disconnected.finish(); disconnected.finish();
  assert.equal(rows[0].upstreamStatus, 426);
  assert.equal(rows[1].upstreamStatus, null);
  assert.equal(rows.length, 2);
  assert.equal(JSON.stringify(rows).includes('private'), false);
});

test('oversized or malformed headers are bounded and never parsed as payload', () => {
  const rows = [];
  const capture = createHandshakeCapture({}, (row) => rows.push(row));
  capture.data(Buffer.alloc(100_000, 65)); capture.data(Buffer.from('\r\n\r\n')); capture.finish();
  assert.equal(rows.length, 1); assert.equal(rows[0].upstreamStatus, null);
  assert.deepEqual(rows[0].protocolsAccepted, []);
  assert.deepEqual(sanitizeHandshakeRequest({ 'sec-websocket-protocol': 'x'.repeat(20_000) }).protocolsOffered, ['malformed']);
});

test('diagnostic artifacts are private and symlinks are refused', () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'native-ws-log-'));
  try {
    const directory = path.join(temporary, 'private');
    const write = createHandshakeLog(directory);
    write({ timestamp: 'example', upstreamStatus: 101, authorization: 'private-token', url: '/app/private-key?secret=gate' });
    const file = path.join(directory, 'websocket-handshake.jsonl');
    assert.equal(statSync(directory).mode & 0o777, 0o700);
    assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { timestamp: 'example', upstreamStatus: 101 });
    const linked = path.join(temporary, 'link'); symlinkSync(directory, linked);
    assert.throws(() => createHandshakeLog(linked), /symlink/i);
    rmSync(file); symlinkSync(path.join(temporary, 'outside.jsonl'), file);
    assert.throws(() => write({ upstreamStatus: 101 }));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
