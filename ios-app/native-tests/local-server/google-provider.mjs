import { randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const origin = 'https://127.0.0.1:9443';
const prefix = '/__native_fixture/google/';
const callback = `${origin}/auth/google/callback`;
const same = (actual, expected) => typeof actual === 'string' && typeof expected === 'string' && Buffer.byteLength(actual) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));

export function localGoogleProvider(runtime, { now = Date.now } = {}) {
  const config = JSON.parse(readFileSync(path.join(runtime, 'google-provider.json'), 'utf8'));
  const fixture = JSON.parse(readFileSync(path.join(runtime, 'fixture.json'), 'utf8'));
  if (config.environment !== 'testing' || config.origin !== origin || config.redirectUri !== callback || fixture.origin !== origin || fixture.users.member.id !== 101
    || readFileSync(path.join(runtime, 'fixture-marker'), 'utf8').trim() !== 'native-loopback-fixture-v1') throw new Error('The local provider requires the isolated HTTPS test fixture.');
  const states = new Map(), consents = new Map(), codes = new Map(), access = new Map();
  const prune = () => { for (const map of [states, consents, codes, access]) for (const [key, value] of map) if (value.expires <= now()) map.delete(key); };
  const json = (outgoing, status, value) => { outgoing.writeHead(status, { 'Content-Type': 'application/json' }); outgoing.end(JSON.stringify(value)); };
  const redirect = (outgoing, values) => { outgoing.writeHead(302, { Location: `${callback}?${new URLSearchParams(values)}` }); outgoing.end(); };
  const form = (incoming, callback) => {
    let body = '', size = 0;
    incoming.on('data', (chunk) => { size += chunk.length; if (size > 8192) incoming.destroy(); else body += chunk.toString('utf8'); });
    incoming.on('end', () => callback(new URLSearchParams(body)));
  };
  return (incoming, outgoing) => {
    const url = new URL(incoming.url ?? '/', origin);
    if (!url.pathname.startsWith(prefix)) return false;
    const incomingOrigin = incoming.headers.origin;
    let diagnosticOrigin = incomingOrigin === undefined ? null : incomingOrigin === 'null' ? 'null' : '<invalid origin>';
    if (typeof incomingOrigin === 'string' && incomingOrigin !== 'null') {
      try { diagnosticOrigin = new URL(incomingOrigin).origin; } catch { /* Never record a malformed header's arbitrary text. */ }
    }
    appendFileSync(path.join(runtime, 'provider-request-metadata.jsonl'), JSON.stringify({ method: incoming.method, path: url.pathname,
      origin: diagnosticOrigin, host: incoming.headers.host ?? null, secure: Boolean(incoming.socket.encrypted), remoteIP: incoming.socket.remoteAddress ?? null }) + '\n', { mode: 0o600 });
    outgoing.setHeader('Cache-Control', 'no-store, private');
    outgoing.setHeader('Referrer-Policy', 'no-referrer');
    outgoing.setHeader('X-Content-Type-Options', 'nosniff');
    if (incoming.socket.remoteAddress !== '127.0.0.1' || !incoming.socket.encrypted || incoming.headers.host !== '127.0.0.1:9443'
      || incoming.headers.origin && incoming.headers.origin !== origin) { json(outgoing, 403, { error: 'local_fixture_only' }); return true; }
    prune();
    if (incoming.method === 'GET' && url.pathname === `${prefix}authorize`) {
      const q = url.searchParams, state = q.get('state');
      if (q.get('client_id') !== config.clientId || q.get('redirect_uri') !== callback || q.get('response_type') !== 'code'
        || typeof state !== 'string' || !/^[A-Za-z0-9]{20,512}$/.test(state) || q.getAll('state').length !== 1) { json(outgoing, 422, { error: 'invalid_local_authorization' }); return true; }
      let record = states.get(state);
      if (record && (record.used || record.consentExpires <= now())) { json(outgoing, 409, { error: 'local_state_already_used_or_expired' }); return true; }
      if (!record) {
        if (states.size >= 256) { json(outgoing, 429, { error: 'local_fixture_capacity' }); return true; }
        // Retain a non-usable replay marker for the source broker's full context lifetime.
        record = { state, nonce: randomBytes(32).toString('hex'), consentExpires: now() + 120000, expires: now() + 600000, used: false };
        states.set(state, record); consents.set(record.nonce, record);
      }
      // Non-CORS form posts inherit their Origin serialization from this document policy.
      outgoing.setHeader('Referrer-Policy', 'strict-origin');
      // WebKit checks form redirect targets too. A hostless callback can only use a scheme-source.
      // The real broker and native parser separately bind its exact /oauth/google path and state.
      outgoing.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' zone.syrian.ios:; base-uri 'none'; frame-ancestors 'none'" });
      outgoing.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Local provider fixture</title><style>body{font:18px system-ui;margin:32px;line-height:1.5}button{display:block;padding:16px;margin:18px 0;font:inherit;min-height:48px}</style><main><h1>Local provider fixture</h1><p>This is a simulated provider for the isolated native browser test. It does not contact Google or establish real Google verification.</p><p>Only synthetic member 101, member@native-fixture.invalid, is available.</p><form method="post" action="${prefix}consent"><input type="hidden" name="nonce" value="${record.nonce}"><button name="decision" value="approve">Continue as local member 101</button><button name="decision" value="cancel">Cancel local sign-in</button></form></main></html>`);
    } else if (incoming.method === 'POST' && url.pathname === `${prefix}consent`) {
      form(incoming, (fields) => {
        const record = consents.get(fields.get('nonce'));
        if (!record || record.used || record.consentExpires <= now() || fields.getAll('nonce').length !== 1 || !['approve', 'cancel'].includes(fields.get('decision'))) { json(outgoing, 409, { error: 'invalid_or_used_local_consent' }); return; }
        record.used = true; consents.delete(record.nonce);
        if (fields.get('decision') === 'cancel') { redirect(outgoing, { error: 'access_denied', state: record.state }); return; }
        const code = randomBytes(32).toString('base64url');
        codes.set(code, { expires: now() + 60000, state: record.state });
        redirect(outgoing, { code, state: record.state });
      });
    } else if (incoming.method === 'POST' && url.pathname === `${prefix}token`) {
      form(incoming, (fields) => {
        const code = fields.get('code'), record = codes.get(code);
        if (fields.get('client_id') !== config.clientId || !same(fields.get('client_secret'), config.clientSecret) || fields.get('redirect_uri') !== callback
          || fields.get('grant_type') !== 'authorization_code' || !record || record.expires <= now()) { json(outgoing, 400, { error: 'invalid_grant' }); return; }
        codes.delete(code);
        const token = randomBytes(32).toString('base64url');
        access.set(token, { expires: now() + 30000 });
        json(outgoing, 200, { access_token: token, token_type: 'Bearer', expires_in: 30, scope: 'openid profile email' });
      });
    } else if (incoming.method === 'GET' && url.pathname === `${prefix}userinfo`) {
      const authorization = incoming.headers.authorization;
      const token = typeof authorization === 'string' && authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      const record = access.get(token);
      if (!record || record.expires <= now()) json(outgoing, 401, { error: 'invalid_token' });
      else {
        access.delete(token);
        json(outgoing, 200, { sub: 'local-google-member-101', email: 'member@native-fixture.invalid', email_verified: true, name: 'Local provider fixture member 101' });
      }
    } else json(outgoing, 404, { error: 'unknown_local_provider_endpoint' });
    return true;
  };
}
