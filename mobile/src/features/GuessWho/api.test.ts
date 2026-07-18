import type { ApiClient, ApiRequestOptions } from '@/lib/api/client';

import { createGuessWhoApi } from './api';
import type { GuessWhoCredential } from './types';

const credential: GuessWhoCredential = {
  credential: 'opaque-secret-credential-value-1234567890',
  expires_at: '2026-07-16T14:00:00.000Z',
  session_id: 'public-session-1',
};

const characters = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  image_path: `guesswho/${index + 1}.jpg`,
  name_ar: `الشخصية ${index + 1}`,
}));

describe('Guess Who mobile API contract', () => {
  test('keeps the opaque credential in the header for room operations', async () => {
    const calls: { options: ApiRequestOptions<unknown>; path: string }[] = [];
    const client: ApiClient = {
      async request<T>(path: string, options: ApiRequestOptions<T>): Promise<T> {
        calls.push({ options: options as ApiRequestOptions<unknown>, path });
        const data = path.endsWith('/join')
          ? { generation: 1, role: 'player_2', room_code: 'room-1234' }
          : { generation: 0, role: 'player_1', room_code: 'room-1234' };
        return options.schema.parse({ data });
      },
    };
    const api = createGuessWhoApi(client);

    await api.createRoom('random', credential);
    await api.joinRoom('room-1234', credential);

    expect(calls.map((call) => call.path)).toEqual([
      '/api/mobile/guess-who/rooms',
      '/api/mobile/guess-who/rooms/room-1234/join',
    ]);
    expect(calls[0]?.options.body).toEqual({ category_id: 'random' });
    expect(calls[1]?.options.body).toBeUndefined();
    for (const call of calls) {
      expect(call.options.headers).toEqual({
        'X-Guess-Who-Session-ID': credential.credential,
      });
      expect(JSON.stringify(call.options.body ?? {})).not.toContain(
        credential.credential,
      );
    }
  });

  test('derives signaling identity from the credential instead of the body', async () => {
    let captured: { options: ApiRequestOptions<unknown>; path: string } | null = null;
    const client: ApiClient = {
      async request<T>(path: string, options: ApiRequestOptions<T>): Promise<T> {
        captured = { options: options as ApiRequestOptions<unknown>, path };
        return options.schema.parse({ data: { status: 'signal_sent' } });
      },
    };
    const api = createGuessWhoApi(client);
    await api.sendSignal('room-1234', credential.credential, {
      data: { candidate: 'candidate:1' },
      generation: 4,
      target_session: 'public-session-2',
      type: 'candidate',
    });

    expect(captured).toEqual({
      options: expect.objectContaining({
        auth: false,
        body: {
          data: { candidate: 'candidate:1' },
          generation: 4,
          target_session: 'public-session-2',
          type: 'candidate',
        },
        headers: { 'X-Guess-Who-Session-ID': credential.credential },
        method: 'POST',
      }),
      path: '/api/mobile/guess-who/rooms/room-1234/signal',
    });
    expect(JSON.stringify(captured)).not.toContain('sender_session');
  });

  test('validates room, realtime, and short-lived TURN responses', async () => {
    const client: ApiClient = {
      async request<T>(path: string, options: ApiRequestOptions<T>): Promise<T> {
        const payload = path.endsWith('/room-1234')
          ? {
              category: { characters, name_ar: 'شخصيات سورية' },
              generation: 6,
              role: 'player_1',
              room_code: 'room-1234',
              status: 'playing',
            }
          : path.endsWith('/turn-credentials')
            ? {
                expires_at: '2026-07-16T12:05:00.000Z',
                ice_servers: [
                  {
                    credential: 'turn-secret',
                    urls: ['turns:turn.example.test:443'],
                    username: 'short-lived',
                  },
                ],
              }
            : {
                force_tls: true,
                host: 'ws.example.test',
                key: 'reverb-key',
                ws_port: 80,
                wss_port: 443,
              };
        return options.schema.parse({ data: payload });
      },
    };
    const api = createGuessWhoApi(client);

    await expect(api.getRoom('room-1234', credential.credential)).resolves.toMatchObject({
      generation: 6,
      role: 'player_1',
    });
    await expect(
      api.getTurnCredentials('room-1234', credential.credential),
    ).resolves.toMatchObject({ expires_at: '2026-07-16T12:05:00.000Z' });
    await expect(api.getRealtimeConfig()).resolves.toEqual({
      force_tls: true,
      host: 'ws.example.test',
      key: 'reverb-key',
      ws_port: 80,
      wss_port: 443,
    });
  });
});
