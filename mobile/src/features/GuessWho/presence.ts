import { createRealtimeConnection } from '@/lib/realtime';

import type {
  GuessWhoPresenceMember,
  GuessWhoRealtimeConfig,
  GuessWhoSignal,
} from './types';

export interface GuessWhoPresenceCallbacks {
  onError: () => void;
  onHere: (members: readonly GuessWhoPresenceMember[]) => void;
  onJoining: (member: GuessWhoPresenceMember) => void;
  onLeaving: (member: GuessWhoPresenceMember) => void;
  onSignal: (signal: GuessWhoSignal) => void;
  onStatus: (status: string) => void;
}

export interface GuessWhoPresenceConnection {
  close: () => void;
}

function readMember(value: unknown): GuessWhoPresenceMember | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('session_id' in value) ||
    typeof value.session_id !== 'string'
  ) {
    return null;
  }
  return {
    name:
      'name' in value && typeof value.name === 'string'
        ? value.name
        : 'لاعب آخر',
    session_id: value.session_id,
  };
}

export function readSignal(value: unknown): GuessWhoSignal | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('data' in value) ||
    !('generation' in value) ||
    typeof value.generation !== 'number' ||
    !Number.isInteger(value.generation) ||
    value.generation < 1 ||
    !('sender_session' in value) ||
    typeof value.sender_session !== 'string' ||
    !('target_session' in value) ||
    typeof value.target_session !== 'string' ||
    !('type' in value) ||
    (value.type !== 'offer' &&
      value.type !== 'answer' &&
      value.type !== 'candidate')
  ) {
    return null;
  }
  return {
    data: value.data,
    generation: value.generation,
    sender_session: value.sender_session,
    target_session: value.target_session,
    type: value.type,
  };
}

export function connectGuessWhoPresence(
  config: GuessWhoRealtimeConfig,
  credential: string,
  roomCode: string,
  callbacks: GuessWhoPresenceCallbacks,
): GuessWhoPresenceConnection {
  const echo = createRealtimeConnection({
    authEndpoint: '/api/mobile/guess-who/broadcasting/auth',
    authHeaders: { 'X-Guess-Who-Session-ID': credential },
    config: {
      forceTls: config.force_tls,
      host: config.host,
      key: config.key,
      wsPort: config.ws_port,
      wssPort: config.wss_port,
    },
  });
  const channelName = `guesswho.${roomCode}`;
  const unsubscribeStatus = echo.connector.onConnectionChange((status) => {
    callbacks.onStatus(status);
  });
  echo
    .join(channelName)
    .here((rawMembers: unknown[]) => {
      callbacks.onHere(
        rawMembers
          .map(readMember)
          .filter((member): member is GuessWhoPresenceMember => member !== null),
      );
    })
    .joining((rawMember: unknown) => {
      const member = readMember(rawMember);
      if (member) {
        callbacks.onJoining(member);
      }
    })
    .leaving((rawMember: unknown) => {
      const member = readMember(rawMember);
      if (member) {
        callbacks.onLeaving(member);
      }
    })
    .listen('.signal', (rawSignal: unknown) => {
      const signal = readSignal(rawSignal);
      if (signal) {
        callbacks.onSignal(signal);
      }
    })
    .error(() => callbacks.onError());

  return {
    close() {
      unsubscribeStatus();
      echo.leave(channelName);
      echo.disconnect();
    },
  };
}
