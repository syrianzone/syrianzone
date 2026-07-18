import { readSignal } from './presence';

describe('Guess Who presence payloads', () => {
  test('accepts the snake-case generation-bound signal contract', () => {
    expect(
      readSignal({
        data: { sdp: 'encoded', type: 'offer' },
        generation: 4,
        sender_session: 'public-session-1',
        target_session: 'public-session-2',
        type: 'offer',
      }),
    ).toEqual({
      data: { sdp: 'encoded', type: 'offer' },
      generation: 4,
      sender_session: 'public-session-1',
      target_session: 'public-session-2',
      type: 'offer',
    });
  });

  test('rejects stale unversioned and camel-case browser signals', () => {
    expect(
      readSignal({
        data: {},
        senderSession: 'public-session-1',
        targetSession: 'public-session-2',
        type: 'candidate',
      }),
    ).toBeNull();
    expect(
      readSignal({
        data: {},
        generation: 0,
        sender_session: 'public-session-1',
        target_session: 'public-session-2',
        type: 'candidate',
      }),
    ).toBeNull();
  });
});
