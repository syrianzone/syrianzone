import Echo from 'laravel-echo';
import Pusher from 'pusher-js/react-native';

import { apiOrigin } from './env';

export interface ReverbConnectionConfig {
  forceTls: boolean;
  host: string;
  key: string;
  wsPort: number;
  wssPort: number;
}

export interface ReverbConnectionOptions {
  authEndpoint: string;
  authHeaders?: Readonly<Record<string, string>>;
  config: ReverbConnectionConfig;
}

function resolveAuthEndpoint(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return new URL(path.replace(/^\/+/, ''), `${apiOrigin}/`).toString();
}

export function createRealtimeConnection({
  authEndpoint,
  authHeaders = {},
  config,
}: ReverbConnectionOptions): Echo<'reverb'> {
  return new Echo({
    activityTimeout: 25_000,
    auth: { headers: { ...authHeaders } },
    authEndpoint: resolveAuthEndpoint(authEndpoint),
    broadcaster: 'reverb',
    client: Pusher,
    enabledTransports: ['ws', 'wss'],
    forceTLS: config.forceTls,
    key: config.key,
    pongTimeout: 10_000,
    wsHost: config.host,
    wsPort: config.wsPort,
    wssPort: config.wssPort,
  });
}

/*
PORT STATUS
  source:     resources/js/echo.js (31 lines)
  confidence: high
  todos:      0
  notes:      Reverb settings and authorization are injected so server-issued room credentials stay at the caller boundary.
*/
