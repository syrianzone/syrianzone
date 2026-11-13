// Consent is the gate in front of every Google Analytics request, so its pure
// side is tested directly: state parsing, the privacy signal, and the page-view
// sender's two conditions. The test environment is `node` (no DOM), which is
// why the module takes its storage and sender as arguments.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ANALYTICS_CONSENT_KEY,
    currentConsent,
    isBannerPending,
    isPrivacySignal,
    parseConsent,
    readConsent,
    resolveConsent,
    sendPageView,
    trackPageView,
    writeConsent,
    type ConsentStorage,
    type PageViewContext,
} from './analyticsConsent';

function memoryStorage(
    initial: Record<string, string> = {},
    options: { throwOnRead?: boolean; throwOnWrite?: boolean } = {},
) {
    const data = new Map(Object.entries(initial));
    const storage: ConsentStorage = {
        getItem(key) {
            if (options.throwOnRead) throw new Error('blocked');
            return data.get(key) ?? null;
        },
        setItem(key, value) {
            if (options.throwOnWrite) throw new Error('blocked');
            data.set(key, value);
        },
    };
    return { storage, data };
}

function pageViewContext(overrides: Partial<PageViewContext> = {}): PageViewContext & {
    gtag: ReturnType<typeof vi.fn>;
} {
    const gtag = vi.fn();
    return {
        consent: 'granted',
        loaded: true,
        id: 'G-TEST123',
        origin: 'https://syrian.zone',
        gtag,
        ...overrides,
    } as PageViewContext & { gtag: ReturnType<typeof vi.fn> };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('consent state', () => {
    it('parses only the two recorded answers', () => {
        expect(parseConsent('granted')).toBe('granted');
        expect(parseConsent('denied')).toBe('denied');
        expect(parseConsent(null)).toBeNull();
        expect(parseConsent(undefined)).toBeNull();
        expect(parseConsent('')).toBeNull();
        expect(parseConsent('GRANTED')).toBeNull();
        expect(parseConsent(true)).toBeNull();
    });

    it('defaults to unset when nothing is stored or the value is unknown', () => {
        const empty = memoryStorage();
        expect(readConsent(empty.storage)).toBeNull();

        const unknown = memoryStorage({ [ANALYTICS_CONSENT_KEY]: 'maybe' });
        expect(readConsent(unknown.storage)).toBeNull();

        expect(readConsent(null)).toBeNull();
    });

    it('reads a stored answer', () => {
        const { storage } = memoryStorage({ [ANALYTICS_CONSENT_KEY]: 'denied' });
        expect(readConsent(storage)).toBe('denied');
    });

    it('survives storage that throws', () => {
        const blockedRead = memoryStorage({}, { throwOnRead: true });
        expect(readConsent(blockedRead.storage)).toBeNull();

        const blockedWrite = memoryStorage({}, { throwOnWrite: true });
        expect(() => writeConsent('granted', blockedWrite.storage)).not.toThrow();
        expect(blockedWrite.data.size).toBe(0);
    });

    it('writes under the module key only', () => {
        const { storage, data } = memoryStorage();
        writeConsent('granted', storage);
        expect(data.get(ANALYTICS_CONSENT_KEY)).toBe('granted');
        expect([...data.keys()]).toEqual([ANALYTICS_CONSENT_KEY]);
    });

    it('is unset without a window (SSR)', () => {
        // The node environment has no window at all: this is the SSR path.
        expect(typeof window).toBe('undefined');
        expect(currentConsent()).toBeNull();
        expect(trackPageView('/transit?q=1')).toBe(false);
    });
});

describe('consent banner', () => {
    it('is pending only while analytics is configured and unanswered', () => {
        expect(isBannerPending('G-TEST123', null)).toBe(true);
        expect(isBannerPending('G-TEST123', 'granted')).toBe(false);
        expect(isBannerPending('G-TEST123', 'denied')).toBe(false);
        // No id: analytics cannot run, so no card is shown and nothing waits.
        expect(isBannerPending(null, null)).toBe(false);
    });
});

describe('privacy signal', () => {
    it('counts only an explicit true', () => {
        expect(isPrivacySignal(true)).toBe(true);
        expect(isPrivacySignal(false)).toBe(false);
        expect(isPrivacySignal(undefined)).toBe(false);
        expect(isPrivacySignal('true')).toBe(false);
        expect(isPrivacySignal(1)).toBe(false);
    });

    it('overrides any recorded answer, including a grant', () => {
        expect(resolveConsent(null, true)).toBe('denied');
        expect(resolveConsent('granted', true)).toBe('denied');
        expect(resolveConsent('denied', true)).toBe('denied');

        expect(resolveConsent(null, false)).toBeNull();
        expect(resolveConsent('granted', false)).toBe('granted');
        expect(resolveConsent('denied', false)).toBe('denied');
    });
});

describe('page views', () => {
    it('sends nothing without consent', () => {
        const sender = pageViewContext({ consent: null });
        expect(sendPageView('/about', sender)).toBe(false);
        expect(sender.gtag).not.toHaveBeenCalled();
    });

    it('sends nothing after a refusal', () => {
        const sender = pageViewContext({ consent: 'denied' });
        expect(sendPageView('/about', sender)).toBe(false);
        expect(sender.gtag).not.toHaveBeenCalled();
    });

    it('sends nothing before gtag has loaded', () => {
        const sender = pageViewContext({ loaded: false });
        expect(sendPageView('/about', sender)).toBe(false);
        expect(sender.gtag).not.toHaveBeenCalled();
    });

    it('sends nothing without an id or a sender', () => {
        expect(sendPageView('/about', pageViewContext({ id: null }))).toBe(false);
        expect(sendPageView('/about', pageViewContext({ gtag: null }))).toBe(false);
    });

    it('sends one page view with the query string stripped', () => {
        const sender = pageViewContext();

        expect(sendPageView('/transit/city/damascus?q=hospitals&room=42#top', sender)).toBe(true);
        expect(sender.gtag).toHaveBeenCalledTimes(1);
        expect(sender.gtag).toHaveBeenCalledWith('config', 'G-TEST123', {
            page_path: '/transit/city/damascus',
            page_location: 'https://syrian.zone/transit/city/damascus',
        });
    });
});
