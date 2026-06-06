import Echo from 'laravel-echo';

import Pusher from 'pusher-js';
window.Pusher = Pusher;

import { getGuessWhoSessionId } from './Lib/guessWhoSession';

const sessionId = getGuessWhoSessionId();

const reverbConfig = (typeof window !== 'undefined' && window.REVERB_CONFIG) || {};
const fallbackHost = (typeof window !== 'undefined' && window.location.hostname)
    ? window.location.hostname
    : (reverbConfig.host || 'localhost');

window.Echo = new Echo({
    broadcaster: 'reverb',
    key: reverbConfig.key || '',
    wsHost: fallbackHost,
    wsPort: reverbConfig.port ?? 80,
    wssPort: reverbConfig.port ?? 443,
    forceTLS: (reverbConfig.scheme ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
    activityTimeout: 25000,
    pongTimeout: 10000,
    authEndpoint: '/guesswho/broadcasting/auth',
    auth: {
        headers: {
            'X-Guess-Who-Session-ID': sessionId,
        }
    }
});
