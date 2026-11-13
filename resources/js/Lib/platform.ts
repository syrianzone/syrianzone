import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const serverSnapshot = () => false;

function detectMac(): boolean {
    return typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent || '');
}

/**
 * Whether the browser is on macOS. The platform cannot change during a session,
 * so there is nothing to subscribe to; the server snapshot is `false` and the
 * real answer arrives with hydration, which keeps the server HTML and the first
 * client render identical (the shortcut label reads this).
 */
export function useIsMac(): boolean {
    return useSyncExternalStore(subscribe, detectMac, serverSnapshot);
}
