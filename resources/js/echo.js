import Echo from 'laravel-echo';

import Pusher from 'pusher-js';
window.Pusher = Pusher;

import { getGuessWhoSessionId } from './Lib/guessWhoSession';

// Generate session ID immediately if not exists
const sessionId = getGuessWhoSessionId();

// Use the current page's hostname so that whether the user opens via
// "localhost" or "127.0.0.1", Echo connects to the same origin and the
// /guesswho/broadcasting/auth endpoint is called on the correct host.
const wsHost = (typeof window !== 'undefined' && window.location.hostname)
    ? window.location.hostname
    : import.meta.env.VITE_REVERB_HOST;

window.Echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: wsHost,
    wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
    wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: '/guesswho/broadcasting/auth',
    auth: {
        headers: {
            'X-Guess-Who-Session-ID': sessionId,
        }
    }
});
