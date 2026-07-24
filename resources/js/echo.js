import { getGuessWhoSessionId } from './Lib/guessWhoSession';

let echoInstance = null;
let echoPromise = null;

export async function initEcho() {
    if (typeof window === 'undefined') return null;
    if (window.Echo) return window.Echo;
    if (echoPromise) return echoPromise;

    echoPromise = (async () => {
        const [{ default: Echo }, { default: Pusher }] = await Promise.all([
            import('laravel-echo'),
            import('pusher-js'),
        ]);

        window.Pusher = Pusher;

        const sessionId = getGuessWhoSessionId();
        const reverbConfig = window.REVERB_CONFIG || {};
        const fallbackHost = window.location.hostname || reverbConfig.host || 'localhost';

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
                },
            },
        });

        echoInstance = window.Echo;
        return echoInstance;
    })();

    return echoPromise;
}

