#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, openSync, rmSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRealtime } from '../native-tests/local-server/realtime-check.mjs';
import { fixtureSession } from '../native-tests/local-server/session-response.mjs';
import { createPrayerSyncHandler } from '../native-tests/prayer-sync/prayer-sync-proxy.mjs';
import { storageServer } from '../native-tests/local-server/storage-server.mjs';
import { localGoogleProvider } from '../native-tests/local-server/google-provider.mjs';
import { createHandshakeCapture, createHandshakeLog } from '../native-tests/local-server/websocket-metadata.mjs';

const iosRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.dirname(iosRoot);
const runtime = path.join(iosRoot, '.expo/local-fixture');
const sources = path.join(iosRoot, 'native-tests/local-server');
const upstreamPort = 9017;
const httpsPort = 9443;
const stateFile = path.join(runtime, 'services.json');
const fixtureFile = path.join(runtime, 'fixture.json');
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SHELL'].flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mode = process.argv[2] ?? 'status';

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, { cwd: project, env: { ...env, ...extraEnv }, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function prepareLogin() {
  const access = JSON.parse(readFileSync(path.join(runtime, 'access.json'), 'utf8'));
  process.stdout.write(run('php', [path.join(sources, 'prepare-login.php')], { SZ_LOCAL_FIXTURE_ACCESS_KEY: access.key }));
  console.log(`Private login configuration: ${path.join(runtime, 'login.json')}`);
}

function preparePromises() {
  const access = JSON.parse(readFileSync(path.join(runtime, 'access.json'), 'utf8'));
  process.stdout.write(run('php', [path.join(sources, 'prepare-promises.php')], { SZ_LOCAL_FIXTURE_ACCESS_KEY: access.key }));
}

function prepareAtlas() {
  const access = JSON.parse(readFileSync(path.join(runtime, 'access.json'), 'utf8'));
  process.stdout.write(run('php', [path.join(sources, 'prepare-atlas.php')], { SZ_LOCAL_FIXTURE_ACCESS_KEY: access.key }));
}

function prepareAvatar() {
  const access = JSON.parse(readFileSync(path.join(runtime, 'access.json'), 'utf8'));
  process.stdout.write(run('php', [path.join(sources, 'prepare-avatar.php')], { SZ_LOCAL_FIXTURE_ACCESS_KEY: access.key }));
}

function prepareUsers() {
  const access = JSON.parse(readFileSync(path.join(runtime, 'access.json'), 'utf8'));
  process.stdout.write(run('php', [path.join(sources, 'prepare-users.php')], { SZ_LOCAL_FIXTURE_ACCESS_KEY: access.key }));
}

function prepareGoogle() {
  process.umask(0o077);
  const file = path.join(runtime, 'google-provider.json');
  if (!existsSync(file)) writeFileSync(file, JSON.stringify({ environment: 'testing', origin: 'https://127.0.0.1:9443', clientId: 'local-google-fixture', clientSecret: randomBytes(32).toString('hex'), redirectUri: 'https://127.0.0.1:9443/auth/google/callback' }, null, 2), { mode: 0o600 });
  chmodSync(file, 0o600);
}

function setup() {
  if (isRunning()) throw new Error('Stop the fixture before resetting its database.');
  process.umask(0o077);
  rmSync(path.join(runtime, 'storage'), { recursive: true, force: true });
  for (const dir of ['', 'tls', 'bootstrap/cache', 'storage/app/private', 'storage/app/public', 'storage/framework/cache/data', 'storage/framework/sessions', 'storage/framework/views', 'storage/logs']) {
    mkdirSync(path.join(runtime, dir), { recursive: true, mode: 0o700 });
  }
  writeFileSync(path.join(runtime, 'fixture-marker'), 'native-loopback-fixture-v1\n', { mode: 0o600 });
  writeFileSync(path.join(runtime, '.env'), `APP_KEY=base64:${randomBytes(32).toString('base64')}\nREVERB_APP_SECRET=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
  writeFileSync(path.join(runtime, 'access.json'), JSON.stringify({ key: randomBytes(32).toString('hex') }), { mode: 0o600 });
  prepareGoogle();
  if (!existsSync(path.join(runtime, 'tls/ca.pem'))) certificates();
  for (const file of ['.env', 'tls/ca-key.pem', 'tls/server-key.pem']) chmodSync(path.join(runtime, file), 0o600);
  writeFileSync(path.join(runtime, 'database.sqlite'), '', { mode: 0o600 });
  process.stdout.write(run('php', [path.join(sources, 'seed.php')]));
  console.log(`Fixture config: ${fixtureFile}`);
  console.log(`Simulator CA: ${path.join(runtime, 'tls/ca.pem')}`);
}

function certificates() {
    if (isRunning()) throw new Error('Stop the fixture before replacing its certificates.');
    process.umask(0o077);
    mkdirSync(path.join(runtime, 'tls'), { recursive: true, mode: 0o700 });
    writeFileSync(path.join(runtime, 'tls/ca.cnf'), '[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=v3_ca\n[dn]\nCN=Syrian Zone native test CA\n[v3_ca]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always\n');
    run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '30', '-config', path.join(runtime, 'tls/ca.cnf'), '-keyout', path.join(runtime, 'tls/ca-key.pem'), '-out', path.join(runtime, 'tls/ca.pem')]);
    run('openssl', ['req', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-subj', '/CN=localhost', '-keyout', path.join(runtime, 'tls/server-key.pem'), '-out', path.join(runtime, 'tls/server.csr')]);
    writeFileSync(path.join(runtime, 'tls/server.ext'), 'basicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n');
    run('openssl', ['x509', '-req', '-in', path.join(runtime, 'tls/server.csr'), '-CA', path.join(runtime, 'tls/ca.pem'), '-CAkey', path.join(runtime, 'tls/ca-key.pem'), '-CAserial', path.join(runtime, 'tls/ca.srl'), '-CAcreateserial', '-out', path.join(runtime, 'tls/server.pem'), '-days', '30', '-sha256', '-extfile', path.join(runtime, 'tls/server.ext')]);
}

function isRunning() {
  if (!existsSync(stateFile)) return false;
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  try { process.kill(state.proxyPid, 0); return true; } catch { return false; }
}

function reusableUpstreams() {
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
  assert.equal(fixture.origin, 'https://127.0.0.1:9443');
  assert.equal(fixture.databasePath, path.join(runtime, 'database.sqlite'));
  assert.equal(readFileSync(path.join(runtime, 'fixture-marker'), 'utf8').trim(), 'native-loopback-fixture-v1');
  assert.equal(state.origin, fixture.origin);
  assert.equal(state.upstream, 'http://127.0.0.1:9017');
  assert.equal(state.reverb, 'ws://127.0.0.1:9018');
  assert.equal(state.storage, 'http://127.0.0.1:9019');
  for (const [pid, expected] of [[state.phpPid, path.join(sources, 'router.php')], [state.reverbPid, path.join(sources, 'reverb.php')]]) {
    assert.ok(Number.isSafeInteger(pid) && pid > 0);
    const command = run('ps', ['-p', String(pid), '-o', 'uid=,command=']).trim();
    assert.ok(command.startsWith(`${process.getuid()} `) && command.includes(expected), 'Refusing an unrelated upstream process.');
  }
  return state;
}

async function launchProxy(reuse = false) {
  const log = openSync(path.join(runtime, 'proxy.log'), 'a', 0o600);
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '_serve', ...(reuse ? ['--reuse-upstreams'] : [])], { cwd: project, env, detached: true, stdio: ['ignore', log, log] });
  child.unref();
  for (let attempt = 0; attempt < 50; attempt++) {
    if (isRunning() && JSON.parse(readFileSync(stateFile, 'utf8')).proxyPid === child.pid) return;
    await pause(100);
  }
  throw new Error('The local proxy did not start. Read its ignored proxy.log.');
}

async function restartProxy() {
  assert.ok(isRunning(), 'An existing local proxy is required.');
  const previous = reusableUpstreams();
  const command = run('ps', ['-p', String(previous.proxyPid), '-o', 'uid=,command=']).trim();
  assert.ok(command.startsWith(`${process.getuid()} `) && command.includes(fileURLToPath(import.meta.url)) && command.includes('_serve'), 'Refusing an unrelated proxy process.');
  // The earlier loaded proxy has no handoff signal; bypass its child-stop handler.
  // Only this verified proxy PID exits. PHP and Reverb keep their processes/state.
  process.kill(previous.proxyPid, 'SIGKILL');
  for (let attempt = 0; attempt < 50 && isRunning(); attempt++) await pause(100);
  assert.ok(!isRunning(), 'The prior local proxy has not exited.');
  reusableUpstreams();
  await launchProxy(true);
  const current = reusableUpstreams();
  assert.equal(current.phpPid, previous.phpPid); assert.equal(current.reverbPid, previous.reverbPid);
  console.log(`Restarted only the local proxy (${current.proxyPid}); PHP (${current.phpPid}), Reverb (${current.reverbPid}), stored assets and database were preserved.`);
}

async function serve() {
  process.umask(0o077);
  prepareGoogle();
  const google = localGoogleProvider(runtime);
  const handshakeLog = createHandshakeLog(runtime);
  const reused = process.argv.includes('--reuse-upstreams') ? reusableUpstreams() : null;
  const output = openSync(path.join(runtime, 'php.log'), 'a', 0o600);
  const php = reused ? null : spawn('php', ['-d', 'allow_url_fopen=0', '-S', `127.0.0.1:${upstreamPort}`, path.join(sources, 'router.php')], { cwd: project, env, stdio: ['ignore', output, output] });
  const reverbOutput = openSync(path.join(runtime, 'reverb.log'), 'a', 0o600);
  const reverb = reused ? null : spawn('php', ['-d', 'allow_url_fopen=0', path.join(sources, 'reverb.php')], { cwd: project, env, stdio: ['ignore', reverbOutput, reverbOutput] });
  const phpPid = reused?.phpPid ?? php.pid, reverbPid = reused?.reverbPid ?? reverb.pid;
  const assets = storageServer(runtime);
  assets.listen(9019, '127.0.0.1');
  const prayerSync = createPrayerSyncHandler(runtime);
  const server = https.createServer({
    key: readFileSync(path.join(runtime, 'tls/server-key.pem')),
    cert: readFileSync(path.join(runtime, 'tls/server.pem')),
  }, (incoming, outgoing) => {
    if (incoming.url === '/__native_fixture/prayer-sync') { void prayerSync(incoming, outgoing); return; }
    if (fixtureSession(runtime, incoming, outgoing)) return;
    if (google(incoming, outgoing)) return;
    const localAsset = (incoming.url ?? '').startsWith('/fixture-assets/');
    if (localAsset && !['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405); outgoing.end(); return; }
    const forwarded = http.request({
      host: '127.0.0.1', port: localAsset ? 9019 : upstreamPort,
      path: localAsset ? `/native-fixture/${incoming.url.slice('/fixture-assets/'.length)}` : incoming.url,
      method: incoming.method,
      headers: { ...incoming.headers, host: `127.0.0.1:${httpsPort}`, 'x-forwarded-proto': 'https', 'x-forwarded-host': `127.0.0.1:${httpsPort}`, 'x-forwarded-port': String(httpsPort), 'x-forwarded-for': '127.0.0.1' },
    }, (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    });
    forwarded.on('error', () => { outgoing.writeHead(502); outgoing.end('Local PHP server is unavailable.'); });
    incoming.pipe(forwarded);
  });
  server.on('upgrade', (incoming, socket, head) => {
    if (!/^\/app\/[A-Za-z0-9_-]+(?:\?|$)/.test(incoming.url ?? '')) { socket.destroy(); return; }
    const capture = createHandshakeCapture(incoming.headers, handshakeLog);
    const upstream = net.connect(9018, '127.0.0.1', () => {
      const headers = incoming.rawHeaders.reduce((all, value, index, values) => index % 2 === 0 ? `${all}${value}: ${values[index + 1]}\r\n` : all, '');
      upstream.write(`${incoming.method} ${incoming.url} HTTP/${incoming.httpVersion}\r\n${headers}\r\n`);
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('data', capture.data);
    upstream.once('end', capture.finish);
    upstream.once('close', capture.finish);
    upstream.once('error', capture.finish);
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
    upstream.on('close', () => socket.destroy());
  });
  let closing = false;
  const cleanup = () => {
    if (closing) return;
    closing = true;
    if (php) php.kill('SIGTERM');
    if (reverb) reverb.kill('SIGTERM');
    if (reused) {
      try { reusableUpstreams(); process.kill(phpPid, 'SIGTERM'); process.kill(reverbPid, 'SIGTERM'); } catch { /* Refuse to signal a replaced or unrelated PID. */ }
    }
    assets.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  php?.on('exit', cleanup);
  reverb?.on('exit', cleanup);
  if (reused) setInterval(() => { try { process.kill(phpPid, 0); process.kill(reverbPid, 0); } catch { cleanup(); } }, 1000).unref();
  server.on('error', (error) => { console.error(error.message); cleanup(); });
  assets.on('error', (error) => { console.error(error.message); cleanup(); });
  server.listen(httpsPort, '127.0.0.1', () => {
    writeFileSync(stateFile, JSON.stringify({ proxyPid: process.pid, phpPid, reverbPid, origin: `https://127.0.0.1:${httpsPort}`, upstream: `http://127.0.0.1:${upstreamPort}`, reverb: 'ws://127.0.0.1:9018', storage: 'http://127.0.0.1:9019', startedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  });
}

function request(fixture, urlPath, { user, method = 'GET', body, headers = {} } = {}) {
  // Never accept another host, including a redirect destination.
  const url = new URL(urlPath, fixture.origin);
  assert.equal(url.origin, 'https://127.0.0.1:9443');
  const payload = body === undefined ? undefined : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method, ca: readFileSync(fixture.caPath), rejectUnauthorized: true,
      headers: { Accept: 'application/json', ...(user ? { Authorization: `Bearer ${fixture.users[user].token}` } : {}), ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': String(payload.length) } : {}), ...headers },
    }, (response) => {
      const parts = [];
      response.on('data', (part) => parts.push(part));
      response.on('end', () => {
        const text = Buffer.concat(parts).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* HTML is expected for bootstrap. */ }
        resolve({ status: response.statusCode, headers: response.headers, text, json, bytes: Buffer.concat(parts) });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Local request timed out.')));
    req.end(payload);
  });
}

function photoUpload(fields, field = 'photos[]') {
  const boundary = `native-fixture-${randomBytes(12).toString('hex')}`;
  const parts = Object.entries(fields).map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="local-fixture.png"\r\nContent-Type: image/png\r\n\r\n`));
  parts.push(readFileSync(path.join(project, 'public/og/mishwar.png')));
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
}

async function check() {
  const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
  run('php', [path.join(sources, 'clear-cache.php')]);
  let assertions = 0;
  const expectStatus = (response, status, label) => { assert.equal(response.status, status, `${label}: HTTP ${response.status}`); assertions++; return response; };
  const call = async (urlPath, options, status = 200) => expectStatus(await request(fixture, urlPath, options), status, urlPath);
  const root = await call('/', { headers: { Accept: 'text/html' } });
  await call('/__native_fixture/session?user=member', undefined, 403);
  const fixtureAccess = JSON.parse(readFileSync(path.join(runtime, 'access.json'), 'utf8'));
  const fixtureSessionHeaders = { 'X-Native-Fixture-Key': fixtureAccess.key };
  await call('/__native_fixture/session?user=member', { headers: { ...fixtureSessionHeaders, Origin: 'https://example.invalid' } }, 403);
  await call('/__native_fixture/session?user=member', { headers: { ...fixtureSessionHeaders, Origin: fixture.origin } }, 403);
  const localSession = await call('/__native_fixture/session?user=member', { headers: fixtureSessionHeaders });
  assert.ok(typeof localSession.json.token === 'string' && localSession.json.token !== fixture.users.member.token, 'Session endpoint issues a fresh local mobile token.'); assertions++;
  fixture.users.member.token = localSession.json.token;
  await call('/api/v1/user', { user: 'member' });
  await call('/api/v1/auth/logout', { user: 'member', method: 'POST' });
  await call('/api/v1/user', { user: 'member' }, 401);
  const revoked = fixture.users.member.token;
  const renewed = await call('/__native_fixture/session?user=member', { headers: fixtureSessionHeaders });
  assert.ok(typeof renewed.json.token === 'string' && renewed.json.token !== revoked, 'Revoked sessions are replaced with a new mobile token.'); assertions++;
  fixture.users.member.token = renewed.json.token;
  await call('/api/v1/user', { user: 'member' });
  await call('/api/v1/user', { headers: { Authorization: `Bearer ${revoked}` } }, 401);
  for (const user of ['other', 'admin', 'banned']) {
    const session = await call(`/__native_fixture/session?user=${user}`, { headers: fixtureSessionHeaders });
    assert.ok(typeof session.json.token === 'string', 'Provisioned fixture sessions contain a mobile token.'); assertions++;
    fixture.users[user].token = session.json.token;
  }
  await call('/api/v1/user', { user: 'banned' }, 403);
  const bootstrapScript = root.text.match(/<script\b[^>]*data-page="app"[^>]*>([\s\S]*?)<\/script>/);
  const bootstrapAttribute = root.text.match(/\bdata-page="(\{[^"]+)"/);
  assert.ok(bootstrapScript || bootstrapAttribute, 'Home bootstrap exposes Inertia data-page'); assertions++;
  const home = JSON.parse(bootstrapScript ? bootstrapScript[1] : bootstrapAttribute[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&#039;', "'"));
  assert.equal(home.component, 'Home'); assertions++;
  const pageHeaders = { 'X-Inertia': 'true', 'X-Inertia-Version': home.version, 'X-Requested-With': 'XMLHttpRequest' };
  for (const [page, component] of [['/syofficial', 'SyOfficial/Index'], ['/phonebook', 'Phonebook/Index'], ['/govapps', 'GovApps/Index'], ['/tierlist', 'TierList/Index'], ['/guesswho', 'GuessWho/Index']]) {
    const response = await call(page, { headers: pageHeaders });
    assert.equal(response.json.component, component); assertions++;
  }
  await call('/api/v1/user', undefined, 401);
  for (const user of ['member', 'other', 'admin']) {
    const response = await call('/api/v1/user', { user });
    assert.equal(response.json.id, fixture.users[user].id); assertions++;
  }
  await call('/dashboard', { user: 'member', headers: pageHeaders });
  await call('/admin/syofficial', { user: 'member', headers: pageHeaders }, 403);
  await call('/admin/syofficial', { user: 'admin', headers: pageHeaders });
  await call('/api/v1/admin/places', { user: 'member' }, 403);
  await call('/api/v1/admin/places', { user: 'admin' });
  await call('/api/v1/auth/google/token', { method: 'POST', body: {} }, 503);
  await call('/admin/assets', { user: 'admin', headers: pageHeaders });
  await call('/api/v1/admin/assets/list', { user: 'member' }, 403);
  await call('/api/v1/admin/assets/list', { user: 'admin' });
  const uploadedAsset = await call('/api/v1/admin/assets/upload', { user: 'admin', method: 'POST', ...photoUpload({ folder: 'uploads' }, 'file') });
  const asset = await call(new URL(uploadedAsset.json.url).pathname);
  assert.ok(asset.bytes.equals(readFileSync(path.join(project, 'public/og/mishwar.png'))), 'The local S3 client preserves uploaded bytes.'); assertions++;
  const assetList = await call('/api/v1/admin/assets/list?refresh=1', { user: 'admin' });
  assert.ok(assetList.json.files.some((file) => file.path === uploadedAsset.json.path)); assertions++;
  await call('/api/v1/admin/assets/delete', { user: 'member', method: 'DELETE', body: { path: uploadedAsset.json.path } }, 403);
  await call('/api/v1/admin/assets/delete', { user: 'admin', method: 'DELETE', body: { path: uploadedAsset.json.path } });
  await call(new URL(uploadedAsset.json.url).pathname, undefined, 404);
  const account = await call('/api/v1/account', { user: 'member', method: 'PATCH', body: { name: 'مستخدم اختبار محفوظ', email: 'member@native-fixture.invalid' } });
  assert.equal(account.json.user.name, 'مستخدم اختبار محفوظ'); assertions++;
  await call('/api/v1/account', { user: 'member', method: 'PATCH', body: { name: fixture.users.member.name, email: 'member@native-fixture.invalid' } });
  const board = await call('/api/v1/board', { user: 'member' });
  await call('/api/v1/board', { user: 'member', method: 'PUT', body: { document: board.json.document } });
  assert.deepEqual((await call('/api/v1/board', { user: 'member' })).json.document, board.json.document); assertions++;
  const place = await call(`/api/v1/places/${fixture.places.approved}`);
  const photo = place.json.place?.photos?.[0] ?? place.json.photos?.[0];
  assert.ok(photo, 'Approved place has a processed photo'); assertions++;
  await call(new URL(photo.thumb_url).pathname + new URL(photo.thumb_url).search);
  await call(`/api/v1/places/${fixture.places.approved}/save`, { user: 'member', method: 'POST' });
  await call('/api/v1/my/saves', { user: 'member' });
  await call(`/api/v1/places/${fixture.places.approved}/save`, { user: 'member', method: 'DELETE' });
  await call(`/api/v1/my/places/${fixture.places.pending}`, { user: 'other', method: 'PATCH', body: { name: 'لا يمكن تعديله' } }, 404);
  await call('/api/v1/places', { user: 'banned', method: 'POST', body: {} }, 403);
  run('php', [path.join(sources, 'clear-cache.php')]);
  const submitted = await call('/api/v1/places', { user: 'member', method: 'POST', ...photoUpload({ name: 'مكان مرفوع للاختبار', description: 'هذا وصف تجريبي طويل لمكان محلي يحذف بعد الاختبار.', category: place.json.category, lat: 33.5138, lng: 36.2765 }) }, 201);
  const submittedId = submitted.json.id;
  assert.equal(submitted.json.status, 'pending'); assertions++;
  await call(`/api/v1/places/${submittedId}`, undefined, 404);
  await call(`/api/v1/admin/places/${submittedId}/approve`, { user: 'member', method: 'POST' }, 403);
  await call(`/api/v1/admin/places/${submittedId}/approve`, { user: 'admin', method: 'POST' });
  const published = await call(`/api/v1/places/${submittedId}`);
  assert.equal(published.json.name, 'مكان مرفوع للاختبار'); assertions++;
  const uploadedPhoto = published.json.photos[0];
  await call(`/api/v1/my/place-photos/${uploadedPhoto.id}/rotate`, { user: 'member', method: 'POST' });
  await call(`/api/v1/my/places/${submittedId}`, { user: 'member', method: 'PATCH', body: { name: 'مكان تجريبي بعد التعديل' } });
  await call(`/api/v1/admin/places/${submittedId}/reject`, { user: 'admin', method: 'POST', body: { reason: 'رفض تجريبي محلي فقط' } });
  await call(`/api/v1/my/places/${submittedId}/resubmit`, { user: 'member', method: 'POST' });
  await call(`/api/v1/my/places/${submittedId}`, { user: 'member', method: 'DELETE' }, 204);
  await call(`/api/v1/places/${submittedId}`, { user: 'member' }, 404);
  await call(`/api/v1/polls/${fixture.poll.slug}/candidates`);
  const game = fixture.guessWho;
  const rooms = '/api/v1/guesswho/rooms';
  run('php', [path.join(sources, 'clear-cache.php')]);
  const created = await call(rooms, { method: 'POST', body: { category_id: String(game.categoryId), player_session: 'check-a' } });
  const roomPath = `${rooms}/${created.json.room_code}`;
  await call(`${roomPath}/join`, { method: 'POST', body: { player_session: 'check-b' } });
  const act = (sender, action, payload) => call(`${roomPath}/actions`, { method: 'POST', body: { sender_session: sender, action, payload } });
  await act('check-a', 'select_ready', { id: game.characterIds[0] });
  await act('check-b', 'select_ready', { id: game.characterIds[1] });
  const stateA = await call(`${roomPath}/state?sender_session=check-a`);
  assert.equal(stateA.json.turn, 'check-a'); assertions++;
  assert.equal(stateA.json.myCharacterId, game.characterIds[0]); assertions++;
  assert.ok(!('opponentCharacterId' in stateA.json)); assertions++;
  await call(`${roomPath}/state?sender_session=outsider`, undefined, 403);
  await act('check-a', 'pass_turn', {});
  assert.equal((await call(`${roomPath}/state?sender_session=check-b`)).json.turn, 'check-b'); assertions++;
  await act('check-b', 'guess', { character_id: game.characterIds[0] });
  assert.equal((await call(`${roomPath}/state?sender_session=check-b`)).json.winner, 'check-b'); assertions++;
  run('php', [path.join(sources, 'clear-cache.php')]);
  assertions += await checkRealtime(fixture, request);
  run('php', [path.join(sources, 'clear-cache.php')]);
  process.stdout.write(run('bun', [path.join(sources, 'native-client-check.mjs')], { EXPO_PUBLIC_API_ORIGIN: fixture.origin }));
  console.log(`Local HTTPS fixture self-check passed: ${assertions} assertions. Credentials were not printed.`);
}

async function checkLogin() {
  prepareLogin();
  try {
    const savedLogin = readFileSync(path.join(runtime, 'login.json'));
    const refused = spawnSync('php', [path.join(sources, 'prepare-login.php')], { cwd: project, env: { ...env, SZ_LOCAL_FIXTURE_ACCESS_KEY: 'invalid' }, encoding: 'utf8' });
    assert.ok(refused.status !== 0, 'Login preparation refuses an invalid test gate.');
    assert.ok(readFileSync(path.join(runtime, 'login.json')).equals(savedLogin), 'A refused preparation leaves the private login file unchanged.');
    const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
    const credentials = JSON.parse(readFileSync(path.join(runtime, 'login.json'), 'utf8'));
    const response = await request(fixture, '/api/v1/auth/superadmin/token', { method: 'POST', body: { ...credentials, device_name: 'isolated-login-self-check' } });
    assert.equal(response.status, 200, 'The real password endpoint accepts the prepared local credentials.');
    assert.equal(response.json.user.id, 103);
    assert.ok(typeof response.json.token === 'string', 'The password endpoint issued a real mobile token.');
    fixture.users.admin.token = response.json.token;
    assert.equal((await request(fixture, '/api/v1/user', { user: 'admin' })).status, 200);
    assert.equal((await request(fixture, '/api/v1/auth/logout', { user: 'admin', method: 'POST' })).status, 200);
    assert.equal((await request(fixture, '/api/v1/user', { user: 'admin' })).status, 401);
    console.log('Real local administrator password login, user lookup, logout, and token revocation passed.');
  } finally {
    // Leave fresh credentials and only this exact login budget ready for UI tests.
    prepareLogin();
  }
}

if (mode === 'setup') setup();
else if (mode === 'prepare-google') { prepareGoogle(); console.log('Prepared only the private local simulated provider configuration.'); }
else if (mode === 'check-google') process.stdout.write(run('node', [path.join(sources, 'google-browser-check.mjs')]));
else if (mode === 'prepare-login') prepareLogin();
else if (mode === 'prepare-promises') preparePromises();
else if (mode === 'prepare-atlas') prepareAtlas();
else if (mode === 'prepare-avatar') prepareAvatar();
else if (mode === 'prepare-users') prepareUsers();
else if (mode === 'check-atlas') process.stdout.write(run('node', [path.join(sources, 'atlas-check.mjs')]));
else if (mode === 'check-login') await checkLogin();
else if (mode === 'tls') certificates();
else if (mode === '_serve') await serve();
else if (mode === 'restart-proxy') await restartProxy();
else if (mode === 'start') {
  if (!existsSync(fixtureFile)) setup();
  if (!isRunning()) {
    await launchProxy();
  }
  if (!isRunning()) throw new Error('The fixture did not start. Read its ignored proxy.log.');
  console.log(readFileSync(stateFile, 'utf8'));
} else if (mode === 'stop') {
  if (isRunning()) {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    const command = run('ps', ['-p', String(state.proxyPid), '-o', 'command=']);
    assert.ok(command.includes(fileURLToPath(import.meta.url)) && command.includes('_serve'), 'Refusing to stop an unrelated process.');
    process.kill(state.proxyPid, 'SIGTERM');
    for (let attempt = 0; attempt < 50 && isRunning(); attempt++) await pause(100);
    if (isRunning()) throw new Error('The local fixture did not stop in five seconds.');
    console.log('Local fixture stopped.');
  } else console.log('Local fixture is stopped.');
} else if (mode === 'check') await check();
else if (mode === 'status') console.log(isRunning() ? readFileSync(stateFile, 'utf8') : 'Local fixture is stopped.');
else throw new Error('Use setup, tls, start, restart-proxy, check, prepare-google, check-google, prepare-login, prepare-promises, prepare-atlas, prepare-avatar, prepare-users, check-atlas, check-login, status, or stop.');
