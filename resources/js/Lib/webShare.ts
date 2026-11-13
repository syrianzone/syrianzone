import { useSyncExternalStore } from 'react';
import { copyText, type CopyOptions } from '@/Lib/copy';

export interface ShareTarget {
    title?: string;
    text?: string;
    url?: string;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * The one share path: the Web Share API when the browser has it, otherwise the
 * clipboard, with the copied/failed outcome reported by `copyText`. A cancelled
 * share sheet is a deliberate user action and stays silent.
 */
export async function shareOrCopy(target: ShareTarget, options: CopyOptions = {}): Promise<ShareOutcome> {
    const data: ShareData = { title: target.title, text: target.text, url: target.url };
    if (canNativeShare(data)) {
        try {
            await navigator.share(data);
            return 'shared';
        } catch (error) {
            if (isShareCancelled(error)) return 'cancelled';
        }
    }
    const fallback = target.url ?? target.text ?? '';
    if (!fallback) return 'failed';
    return (await copyText(fallback, options)) ? 'copied' : 'failed';
}

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
