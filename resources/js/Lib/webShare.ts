import { useSyncExternalStore } from 'react';

/** File sharing needs canShare; older link-only implementations may omit it. */
export function canNativeShare(data: ShareData): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    if (data.files?.length && typeof navigator.canShare !== 'function') return false;
    try {
        return typeof navigator.canShare !== 'function' || navigator.canShare(data);
    } catch {
        return false;
    }
}

const subscribe = () => () => {};
const serverSnapshot = () => false;

/** Defer browser capability checks until hydration, including File creation. */
export function useCanShare(data: () => ShareData): boolean {
    return useSyncExternalStore(subscribe, () => canNativeShare(data()), serverSnapshot);
}

export function isShareCancelled(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}
