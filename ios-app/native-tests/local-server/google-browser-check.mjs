import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { localGoogleProvider } from './google-provider.mjs';

const runtime = fileURLToPath(new URL('../../.expo/local-fixture/', import.meta.url));
const fixture = JSON.parse(readFileSync(`${runtime}/fixture.json`, 'utf8'));
const provider = JSON.parse(readFileSync(`${runtime}/google-provider.json`, 'utf8'));
const origin = 'https://127.0.0.1:9443';
assert.equal(fixture.origin, origin);
const ca = readFileSync(fixture.caPath);
let assertions = 0;

async function send(path, { method = 'GET', body, form, jar, bearer, headers = {} } = {}) {
  const url = new URL(path, origin);
  assert.equal(url.origin, origin, 'Browser fixture requests never leave loopback HTTPS.');
  const payload = form ? new URLSearchParams(form).toString() : body ? JSON.stringify(body) : undefined;
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, ca, rejectUnauthorized: true, headers: {
      Accept: 'application/json', ...(jar?.size ? { Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(payload ? { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json', 'Content-Length': String(Buffer.byteLength(payload)) } : {}), ...headers,
    } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        for (const cookie of response.headers['set-cookie'] ?? []) {
          const pair = cookie.split(';', 1)[0], split = pair.indexOf('=');
          if (jar && split > 0) jar.set(pair.slice(0, split), pair.slice(split + 1));
        }
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* The consent page is actual HTML. */ }
        resolve({ status: response.statusCode, headers: response.headers, text, json });
      });
    });
    req.on('error', reject); req.setTimeout(15000, () => req.destroy(new Error('Local browser fixture timed out.'))); req.end(payload);
  });
}
const status = (response, expected, label) => { assert.equal(response.status, expected, label); assertions++; return response; };
const location = (response) => { assert.ok(typeof response.headers.location === 'string', 'Expected a browser redirect.'); assertions++; return response.headers.location; };
const native = (response, state, field) => {
  const url = new URL(location(response));
  assert.ok(url.toString().startsWith('zone.syrian.ios:/oauth/google?'), 'The actual broker returns the fixed app callback.'); assertions++;
  assert.ok(url.searchParams.get('state') === state, 'The app callback preserves the client state.'); assertions++;
  assert.ok(url.searchParams.has(field), 'The app callback contains the expected result.'); assertions++;
  return url.searchParams.get(field);
};

function checkProviderExpiry() {
  let clock = 0;
  const handle = localGoogleProvider(runtime, { now: () => clock });
  const invoke = (method, url, form) => {
    const incoming = Object.assign(new EventEmitter(), { method, url, socket: { remoteAddress: '127.0.0.1', encrypted: true }, headers: { host: '127.0.0.1:9443' } });
    const response = { status: null, text: '', setHeader() {}, writeHead(value) { this.status = value; }, end(value = '') { this.text = value; } };
    handle(incoming, response);
    if (form) { incoming.emit('data', Buffer.from(new URLSearchParams(form).toString())); incoming.emit('end'); }
    return response;
  };
  const url = `/__native_fixture/google/authorize?${new URLSearchParams({ client_id: provider.clientId, redirect_uri: provider.redirectUri, response_type: 'code', state: 'A'.repeat(40) })}`;
  const consent = status(invoke('GET', url), 200, 'The provider expiry probe begins a bounded local consent.');
  const nonce = consent.text.match(/name="nonce" value="([a-f0-9]{64})"/)?.[1];
  assert.ok(nonce); assertions++;
  status(invoke('POST', '/__native_fixture/google/consent', { nonce, decision: 'approve' }), 302, 'The provider expiry probe consumes its state once.');
  clock = 120001;
  status(invoke('GET', url), 409, 'A consumed upstream state stays unusable after the consent TTL.');
}

if (process.argv.includes('--state-expiry-only')) {
  checkProviderExpiry();
  console.log('Simulated provider expiry/replay regression passed.');
  process.exit(0);
}

async function begin() {
  const verifier = randomBytes(32).toString('hex'), state = randomBytes(32).toString('hex');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const jar = new Map();
  const started = status(await send(`/auth/google/native?${new URLSearchParams({ code_challenge: challenge, code_challenge_method: 'S256', state })}`, { jar, headers: { Accept: 'text/html' } }), 302, 'Real broker starts a source Laravel browser session.');
  assert.ok(jar.size >= 1, 'Source Laravel session cookies are present.'); assertions++;
  assert.ok(String(started.headers['cache-control']).includes('no-store')); assertions++;
  const authorization = new URL(location(started));
  assert.equal(authorization.origin, origin); assertions++;
  assert.equal(authorization.pathname, '/__native_fixture/google/authorize'); assertions++;
  assert.ok(authorization.searchParams.get('state') !== state, 'Socialite upstream state is independent of the app state.'); assertions++;
  const consent = status(await send(authorization.toString(), { jar, headers: { Accept: 'text/html' } }), 200, 'Local provider fixture consent loads.');
  assert.equal(consent.headers['referrer-policy'], 'strict-origin', 'The consent document preserves a tuple Origin for native Safari form POSTs without exposing query referrers.'); assertions++;
  assert.equal(consent.headers['content-security-policy'], "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' zone.syrian.ios:; base-uri 'none'; frame-ancestors 'none'", 'The form redirect chain permits only loopback and the one app callback scheme.'); assertions++;
  assert.ok(consent.text.includes('<h1>Local provider fixture</h1>')); assertions++;
  assert.ok(consent.text.includes('Continue as local member 101')); assertions++;
  assert.ok(consent.text.includes('does not contact Google')); assertions++;
  const nonce = consent.text.match(/name="nonce" value="([a-f0-9]{64})"/)?.[1];
  assert.ok(nonce, 'Consent includes a one-use local form nonce.'); assertions++;
  return { verifier, state, jar, nonce, authorization };
}

if (process.argv.includes('--consent-policy-only')) {
  const probe = await begin();
  const form = { nonce: probe.nonce, decision: 'approve' };
  status(await send('/__native_fixture/google/consent', { method: 'POST', form, jar: probe.jar, headers: { Origin: 'https://example.invalid' } }), 403, 'Foreign origins remain refused.');
  status(await send('/__native_fixture/google/consent', { method: 'POST', form, jar: probe.jar, headers: { Origin: 'null' } }), 403, 'Null origins remain refused.');
  status(await send('/__native_fixture/google/consent', { method: 'POST', form, jar: probe.jar, headers: { Origin: origin } }), 302, 'The exact same-origin form can still continue.');
  status(await send('/__native_fixture/google/consent', { method: 'POST', form, jar: probe.jar, headers: { Origin: origin } }), 409, 'Rejected origins did not consume consent and successful consent remains one-use.');
  console.log(`Consent document policy and same/null/foreign-Origin regression passed: ${assertions} assertions. No provider callback or account mutation was performed.`);
  process.exit(0);
}

const attempt = await begin();
status(await send('/logout', { method: 'POST', jar: attempt.jar }), 419, 'Source Laravel CSRF protection remains active for browser POST requests.');
status(await send('/__native_fixture/google/authorize', { headers: { Origin: 'https://example.invalid' } }), 403, 'The simulated provider refuses foreign origins.');
status(await send('/__native_fixture/google/consent', { method: 'POST', form: { nonce: attempt.nonce, decision: 'approve' }, jar: attempt.jar, headers: { Origin: 'null' } }), 403, 'A null-origin form remains refused and cannot consume the valid consent.');
const approved = status(await send('/__native_fixture/google/consent', { method: 'POST', form: { nonce: attempt.nonce, decision: 'approve' }, jar: attempt.jar, headers: { Origin: origin } }), 302, 'Explicit local consent creates only an upstream fixture code.');
const callback = new URL(location(approved));
assert.equal(callback.pathname, '/auth/google/callback'); assertions++;
status(await send('/__native_fixture/google/consent', { method: 'POST', form: { nonce: attempt.nonce, decision: 'approve' }, jar: attempt.jar }), 409, 'A local consent nonce cannot be reused.');
const wrongState = new URL(callback); wrongState.searchParams.set('state', 'wrong-state');
const wrong = status(await send(wrongState.toString(), { jar: attempt.jar }), 302, 'A mismatched callback is rejected by the real source controller.');
assert.ok(new URL(location(wrong), origin).searchParams.get('error') === 'auth_failed'); assertions++;
const noCookies = status(await send(callback.toString()), 302, 'A callback without the source browser session is rejected.');
assert.ok(new URL(location(noCookies), origin).searchParams.get('error') === 'auth_failed'); assertions++;
const completed = status(await send(callback.toString(), { jar: attempt.jar }), 302, 'Real Socialite callback consumes the local upstream code and issues a broker handoff.');
const code = native(completed, attempt.state, 'code');
assert.ok(/^[A-Za-z0-9_-]{43}$/.test(code), 'The app gets a broker handoff, never a provider or bearer token.'); assertions++;
const upstreamReplay = await send('/__native_fixture/google/token', { method: 'POST', form: { client_id: provider.clientId, client_secret: provider.clientSecret, redirect_uri: provider.redirectUri, grant_type: 'authorization_code', code: callback.searchParams.get('code') } });
status(upstreamReplay, 400, 'The upstream fixture code is one-use.');
const browserUser = status(await send('/user', { jar: attempt.jar }), 200, 'The source browser session is readable.');
assert.ok(browserUser.json === null || Object.keys(browserUser.json).length === 0, 'Native callback does not sign the browser into an account.'); assertions++;
status(await send('/dashboard', { jar: attempt.jar }), 401, 'The browser cookie alone cannot open the private dashboard.');
const exchange = { code, code_verifier: attempt.verifier, state: attempt.state, device_name: 'local-provider-browser-proof' };
status(await send('/api/v1/auth/google/native/token', { method: 'POST', body: { ...exchange, code_verifier: 'invalid-verifier-that-is-long-enough-for-validation-123456' } }), 401, 'A wrong verifier cannot redeem a real broker grant.');
status(await send('/api/v1/auth/google/native/token', { method: 'POST', body: { ...exchange, state: '0'.repeat(64) } }), 401, 'A wrong client state cannot redeem a real broker grant.');
const session = status(await send('/api/v1/auth/google/native/token', { method: 'POST', body: exchange }), 200, 'Real PKCE exchange mints the existing mobile session DTO.');
assert.equal(session.json.user.id, 101); assertions++;
assert.equal(session.json.user.email, 'member@native-fixture.invalid'); assertions++;
assert.ok(typeof session.json.token === 'string'); assertions++;
assert.ok(String(session.headers['cache-control']).includes('no-store')); assertions++;
status(await send('/api/v1/auth/google/native/token', { method: 'POST', body: exchange }), 401, 'A consumed broker grant cannot be replayed.');
const user = status(await send('/api/v1/user', { bearer: session.json.token }), 200, 'The issued session passes actual source user authentication.');
assert.equal(user.json.id, 101); assertions++;
status(await send('/api/v1/auth/logout', { method: 'POST', bearer: session.json.token }), 200, 'The actual source logout revokes only the test session.');
status(await send('/api/v1/user', { bearer: session.json.token }), 401, 'A revoked broker session is rejected.');

const cancelled = await begin();
const cancellation = status(await send('/__native_fixture/google/consent', { method: 'POST', form: { nonce: cancelled.nonce, decision: 'cancel' }, jar: cancelled.jar, headers: { Origin: origin } }), 302, 'The local provider can cancel without issuing an upstream code.');
const cancelResult = status(await send(location(cancellation), { jar: cancelled.jar }), 302, 'The actual broker handles provider cancellation.');
assert.equal(native(cancelResult, cancelled.state, 'error'), 'auth_failed'); assertions++;
const cancelledUser = (await send('/user', { jar: cancelled.jar })).json;
assert.ok(cancelledUser === null || Object.keys(cancelledUser).length === 0); assertions++;
status(await send(cancelled.authorization.toString(), { jar: cancelled.jar }), 409, 'A consumed upstream state cannot restart local consent.');
checkProviderExpiry();
console.log(`Local simulated provider browser proof passed: ${assertions} assertions. This does not verify Google. No codes, cookies, passwords, or tokens were printed.`);
