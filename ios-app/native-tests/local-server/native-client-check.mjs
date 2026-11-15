import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApiClient, ApiError } from '../../src/api.ts';
import { decodeAccountUser } from '../../src/platform/account-model.ts';
import { record } from '../../src/platform/validation.ts';
import { decodeLobby, decodeRoom, decodeSnapshot } from '../../src/features/GuessWho/model.ts';
import { decodeTierPage } from '../../src/features/TierList/model.ts';
import { syofficialAdmin } from '../../src/features/SyOfficial/admin-model.ts';
import { govappsAdmin } from '../../src/features/GovApps/admin-model.ts';
import { phonebookAdmin } from '../../src/features/Phonebook/admin-model.ts';
import { guesswhoAdmin } from '../../src/features/GuessWho/admin-model.ts';

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('../../.expo/local-fixture/fixture.json', import.meta.url)), 'utf8'));
const ca = readFileSync(fixture.caPath, 'utf8');
const client = createApiClient({
  origin: fixture.origin,
  fetch: (input, init) => {
    assert.equal(new URL(input).origin, fixture.origin, 'Native client requests stay on the fixture origin.');
    return fetch(input, { ...init, tls: { ca, rejectUnauthorized: true } });
  },
});

const lobby = await client.page('/guesswho', 'GuessWho/Index', decodeLobby);
assert.equal(lobby.categories[0].id, fixture.guessWho.categoryId);
assert.equal(lobby.total, 24);
const room = await client.page(`/guesswho/room/${fixture.guessWho.roomCode}`, 'GuessWho/Room', decodeRoom);
assert.equal(room.characters.length, 24);
assert.equal(new URL(room.characters[0].image).origin, fixture.origin);
assert.equal((await fetch(room.characters[0].image, { tls: { ca, rejectUnauthorized: true } })).status, 200);
const snapshot = await client.request(`guesswho/rooms/${fixture.guessWho.roomCode}/state`, decodeSnapshot, { params: { sender_session: fixture.guessWho.playerA } });
assert.equal(snapshot.status, 'selecting');
const tier = await client.page('/tierlist', 'TierList/Index', decodeTierPage);
assert.equal(tier.candidates.length, 4);
const realtime = await client.realtimeConfig();
assert.deepEqual(realtime, { host: '127.0.0.1', port: 9443, scheme: 'https', key: 'native-fixture-key' });
const places = await client.places({});
assert.ok(places.items.some((place) => place.id === fixture.places.approved));
assert.equal((await client.place(fixture.places.approved)).id, fixture.places.approved);

client.setAccessToken(fixture.users.member.token);
const member = await client.request('user', decodeAccountUser, { authenticated: true });
assert.equal(member.id, fixture.users.member.id);
assert.equal(member.effective_permissions.length, 0);
await client.page('/dashboard', 'Dashboard/Index', record, { authenticated: true });
await assert.rejects(client.page('/admin/syofficial', syofficialAdmin.component, syofficialAdmin.decode, { authenticated: true }), (error) => error instanceof ApiError && error.status === 403);

client.setAccessToken(fixture.users.admin.token);
const admin = await client.request('user', decodeAccountUser, { authenticated: true });
assert.ok(admin.effective_permissions.includes('guesswho.manage'));
for (const [route, definition] of [['syofficial', syofficialAdmin], ['govapps', govappsAdmin], ['phonebook', phonebookAdmin], ['guesswho', guesswhoAdmin]]) {
  const data = await client.page(`/admin/${route}`, definition.component, definition.decode, { authenticated: true });
  assert.ok(data.items.length > 0);
}

console.log('Real native API client and decoders passed against the local HTTPS Laravel fixture.');
