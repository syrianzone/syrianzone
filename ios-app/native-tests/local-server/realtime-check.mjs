import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import https from 'node:https';

// Small test client for the actual Pusher protocol. It uses normal TLS checks.
function connect(fixture) {
  return new Promise((resolve, reject) => {
    const req = https.request(`${fixture.origin}/app/native-fixture-key?protocol=7&client=native-fixture&version=1.0&flash=false`, {
      ca: readFileSync(fixture.caPath), rejectUnauthorized: true,
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': randomBytes(16).toString('base64'), Origin: fixture.origin },
    });
    req.on('error', reject);
    req.on('response', (response) => reject(new Error(`Local WSS handshake failed with HTTP ${response.statusCode}.`)));
    req.on('upgrade', (response, socket, initial) => {
      assert.equal(response.statusCode, 101);
      let pending = Buffer.alloc(0);
      const events = [];
      const waiting = [];
      const sendFrame = (opcode, content) => {
        const payload = Buffer.from(content);
        const mask = randomBytes(4);
        const header = Buffer.alloc(payload.length < 126 ? 2 : 4);
        header[0] = 0x80 | opcode;
        header[1] = 0x80 | (payload.length < 126 ? payload.length : 126);
        if (payload.length >= 126) header.writeUInt16BE(payload.length, 2);
        const masked = Buffer.from(payload);
        for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
        socket.write(Buffer.concat([header, mask, masked]));
      };
      const emit = (event) => {
        const index = waiting.findIndex((waiter) => waiter.predicate(event));
        if (index < 0) events.push(event);
        else {
          const waiter = waiting.splice(index, 1)[0];
          clearTimeout(waiter.timeout);
          waiter.resolve(event);
        }
      };
      const receive = (data) => {
        pending = Buffer.concat([pending, data]);
        while (pending.length >= 2) {
          const opcode = pending[0] & 0x0f;
          let length = pending[1] & 0x7f;
          let start = 2;
          if (length === 126) { if (pending.length < 4) return; length = pending.readUInt16BE(2); start = 4; }
          if (length === 127) { if (pending.length < 10) return; length = Number(pending.readBigUInt64BE(2)); start = 10; }
          assert.ok(length < 65536, 'The fixture expects bounded WSS messages.');
          if (pending.length < start + length) return;
          const payload = pending.subarray(start, start + length);
          pending = pending.subarray(start + length);
          if (opcode === 9) sendFrame(10, payload);
          if (opcode === 8) socket.end();
          if (opcode === 1) {
            const event = JSON.parse(payload.toString('utf8'));
            if (typeof event.data === 'string') event.data = JSON.parse(event.data);
            if (event.event === 'pusher:ping') sendFrame(1, JSON.stringify({ event: 'pusher:pong', data: {} }));
            emit(event);
          }
        }
      };
      socket.on('data', receive);
      socket.on('error', (error) => { for (const waiter of waiting.splice(0)) { clearTimeout(waiter.timeout); waiter.reject(error); } });
      const client = {
        send: (event) => sendFrame(1, JSON.stringify(event)),
        close: () => socket.destroy(),
        next(predicate) {
          const index = events.findIndex(predicate);
          if (index >= 0) return Promise.resolve(events.splice(index, 1)[0]);
          return new Promise((resolveEvent, rejectEvent) => {
            const waiter = { predicate, resolve: resolveEvent, reject: rejectEvent, timeout: setTimeout(() => {
              const index = waiting.indexOf(waiter);
              if (index >= 0) waiting.splice(index, 1);
              rejectEvent(new Error('A local Reverb event timed out.'));
            }, 10000) };
            waiting.push(waiter);
          });
        },
      };
      if (initial.length) receive(initial);
      resolve(client);
    });
    req.end();
  });
}

export async function checkRealtime(fixture, request) {
  const created = await request(fixture, '/api/v1/guesswho/rooms', { method: 'POST', body: { category_id: String(fixture.guessWho.categoryId), player_session: 'wss-player-a' } });
  assert.equal(created.status, 200);
  const code = created.json.room_code;
  const roomPath = `/api/v1/guesswho/rooms/${code}`;
  assert.equal((await request(fixture, `${roomPath}/join`, { method: 'POST', body: { player_session: 'wss-player-b' } })).status, 200);
  const a = await connect(fixture);
  const b = await connect(fixture);
  let assertions = 2;
  try {
    const channel = `presence-guesswho.${code}`;
    const subscribe = async (client, identity) => {
      const established = await client.next((event) => event.event === 'pusher:connection_established');
      const auth = await request(fixture, '/api/v1/guesswho/broadcasting/auth', { method: 'POST', body: { channel_name: channel, socket_id: established.data.socket_id, session_id: identity } });
      assert.equal(auth.status, 200); assertions++;
      client.send({ event: 'pusher:subscribe', data: { channel, ...auth.json } });
      await client.next((event) => event.event === 'pusher_internal:subscription_succeeded'); assertions++;
    };
    await subscribe(a, 'wss-player-a');
    await subscribe(b, 'wss-player-b');
    const presence = await a.next((event) => event.event === 'pusher_internal:member_added');
    assert.equal(presence.data.user_id, 'wss-player-b'); assertions++;
    const outsider = await request(fixture, '/api/v1/guesswho/broadcasting/auth', { method: 'POST', body: { channel_name: channel, socket_id: '0.0', session_id: 'wss-outsider' } });
    assert.equal(outsider.status, 403); assertions++;
    const act = async (sender, action, payload) => {
      const response = await request(fixture, `${roomPath}/actions`, { method: 'POST', body: { sender_session: sender, action, payload } });
      assert.equal(response.status, 200); assertions++;
    };
    await act('wss-player-a', 'select_ready', { id: fixture.guessWho.characterIds[0] });
    await act('wss-player-b', 'select_ready', { id: fixture.guessWho.characterIds[1] });
    for (const client of [a, b]) {
      const state = await client.next((event) => event.event === 'state' && event.data.status === 'playing');
      assert.equal(state.data.turn, 'wss-player-a'); assertions++;
      assert.ok(!('myCharacterId' in state.data) && !('opponentCharacterId' in state.data)); assertions++;
    }
    await act('wss-player-a', 'pass_turn', {});
    for (const client of [a, b]) {
      await client.next((event) => event.event === 'state' && event.data.turn === 'wss-player-b'); assertions++;
    }
    await act('wss-player-b', 'guess', { character_id: fixture.guessWho.characterIds[0] });
    for (const client of [a, b]) {
      const state = await client.next((event) => event.event === 'state' && event.data.status === 'finished');
      assert.equal(state.data.winner, 'wss-player-b'); assertions++;
    }
    b.close();
    const left = await a.next((event) => event.event === 'pusher_internal:member_removed');
    assert.equal(left.data.user_id, 'wss-player-b'); assertions++;
  } finally { a.close(); b.close(); }
  return assertions;
}
