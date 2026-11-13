// Single owner of the analytics consent decision, and the only code allowed to
// load Google Analytics. The measurement id arrives as `window.GA_ID` from
// app.blade.php (runtime config, so staging ships nothing); gtag.js is fetched
// from here, and only after the visitor has agreed.
//
// Everything below is SSR-safe: no `window`/`localStorage` is touched at import
// time, storage access is wrapped in try/catch, and the pure helpers accept the
// state they need so they can be tested without a DOM.
//
// Privacy signal: `navigator.globalPrivacyControl === true` is an explicit
// opt-out, so it resolves to "denied" and the banner is never shown. The
// deprecated Do Not Track header is deliberately not read.
import { useEffect, useState } from 'react';
import { pathnameOf } from './routes';

/** localStorage key holding the visitor's decision. */
export const ANALYTICS_CONSENT_KEY = 'sz-analytics-consent';

/** The two answers a visitor can give. No value at all means "unset". */
export type AnalyticsConsent = 'granted' | 'denied';

export interface ConsentStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export interface PageViewContext {
    consent: AnalyticsConsent | null;
    loaded: boolean;
    id: string | null;
    origin: string;
    gtag?: ((...args: unknown[]) => void) | null;
}

const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js';

type ConsentWindow = Window & {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    GA_ID?: string;
};

type ConsentListener = (consent: AnalyticsConsent | null) => void;

const listeners = new Set<ConsentListener>();

// 'idle' until a load is attempted, 'loaded' once gtag.js has run and the
// bootstrap queued the initial page view. Kept per module instance; a hot
// reload finds `window.gtag` and reuses it instead of injecting twice.
let scriptState: 'idle' | 'loading' | 'loaded' = 'idle';

function browserWindow(): ConsentWindow | null {
    return typeof window === 'undefined' ? null : (window as unknown as ConsentWindow);
}

function safeStorage(): ConsentStorage | null {
    try {
        return browserWindow()?.localStorage ?? null;
    } catch {
        // Blocked storage (private mode, cookie policy) throws on access;
        // analytics simply stays off, and the banner asks again next visit.
        return null;
    }
}

/** 'granted'/'denied' from raw storage text; anything else is "no answer". */
export function parseConsent(raw: unknown): AnalyticsConsent | null {
    return raw === 'granted' || raw === 'denied' ? raw : null;
}

export function readConsent(storage: ConsentStorage | null = safeStorage()): AnalyticsConsent | null {
    if (!storage) return null;
    try {
        return parseConsent(storage.getItem(ANALYTICS_CONSENT_KEY));
    } catch {
        return null;
    }
}

export function writeConsent(
    consent: AnalyticsConsent,
    storage: ConsentStorage | null = safeStorage(),
): void {
    if (!storage) return;
    try {
        storage.setItem(ANALYTICS_CONSENT_KEY, consent);
    } catch {
        // Not persisted: the banner reappears on the next visit rather than
        // failing, and nothing is loaded in the meantime.
    }
}

/** Global Privacy Control is an explicit opt-out: only `true` counts. */
export function isPrivacySignal(value: unknown): boolean {
    return value === true;
}

export function deniedByPrivacySignal(): boolean {
    const w = browserWindow();
    if (!w) return false;
    return isPrivacySignal((w.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
}

/** A recorded decision, unless the browser's privacy signal overrides it. */
export function resolveConsent(
    stored: AnalyticsConsent | null,
    privacySignal: boolean,
): AnalyticsConsent | null {
    return privacySignal ? 'denied' : stored;
}

export function currentConsent(): AnalyticsConsent | null {
    return resolveConsent(readConsent(), deniedByPrivacySignal());
}

/**
 * Whether the consent card is (or is about to be) on screen: analytics is
 * configured and the visitor has not answered yet. The card and the first-visit
 * overlays that would otherwise fight it for the bottom of the screen read this
 * one rule, so neither can drift from the other.
 */
export function isBannerPending(id: string | null, consent: AnalyticsConsent | null): boolean {
    return id !== null && consent === null;
}

export function consentBannerPending(): boolean {
    return isBannerPending(getMeasurementId(), currentConsent());
}

/** Fires after every recorded decision, in this tab. */
export function subscribeConsent(listener: ConsentListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function notifyListeners(): void {
    const consent = currentConsent();
    for (const listener of [...listeners]) listener(consent);
}

/** The measurement id exposed by app.blade.php; null when not configured. */
export function getMeasurementId(): string | null {
    const id = browserWindow()?.GA_ID;
    return typeof id === 'string' && id.trim() !== '' ? id.trim() : null;
}

export function analyticsLoaded(): boolean {
    return scriptState === 'loaded';
}

/**
 * Google's documented opt-out switch. Denial sets it, so an already-loaded
 * gtag.js stops sending; granting clears it again for this tab.
 */
function setOptOut(id: string, disabled: boolean): void {
    const w = browserWindow();
    if (!w) return;
    (w as unknown as Record<string, unknown>)[`ga-disable-${id}`] = disabled;
}

/**
 * Loads gtag.js and runs the bootstrap — only when the visitor has granted
 * consent and an id is configured. Idempotent: repeated calls reuse the script
 * and the existing gtag queue.
 */
export function loadAnalytics(): boolean {
    const w = browserWindow();
    const id = getMeasurementId();
    if (!w || !id) return false;
    if (currentConsent() !== 'granted') return false;

    if (scriptState !== 'idle') return scriptState === 'loaded';
    if (typeof document === 'undefined') return false;

    // A previous withdrawal in this tab must not silence a fresh grant.
    setOptOut(id, false);

    // Already queued by an earlier module instance (hot reload): reuse it.
    if (typeof w.gtag === 'function') {
        scriptState = 'loaded';
        return true;
    }

    const bootstrap = () => {
        const now = browserWindow();
        if (!now) return;
        now.dataLayer = now.dataLayer ?? [];
        // Same queue as Google's snippet: gtag.js reads the arguments object.
        now.gtag = function gtag() {
            now.dataLayer?.push(arguments);
        };
        now.gtag('js', new Date());
        // Path only: query strings and fragments carry search terms, room codes
        // and route ids. Keep in step with the SPA page views below.
        now.gtag('config', id, { page_location: now.location.origin + now.location.pathname });
    };

    // A script injected by an earlier module instance (hot reload) may still be
    // loading: finish its bootstrap instead of adding a second copy.
    const existing = document.querySelector<HTMLScriptElement>('script[data-sz-analytics]');
    if (existing) {
        scriptState = 'loading';
        existing.addEventListener(
            'load',
            () => {
                scriptState = 'loaded';
                bootstrap();
            },
            { once: true },
        );
        return true;
    }

    scriptState = 'loading';

    const script = document.createElement('script');
    script.async = true;
    script.src = `${GTAG_SRC}?id=${encodeURIComponent(id)}`;
    script.dataset.szAnalytics = 'true';
    // The policy is report-only today; carrying the page nonce keeps an eventual
    // enforced 'strict-dynamic' policy free of violation reports.
    const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
    if (nonce) script.nonce = nonce;
    script.addEventListener(
        'load',
        () => {
            scriptState = 'loaded';
            bootstrap();
        },
        { once: true },
    );
    script.addEventListener(
        'error',
        () => {
            scriptState = 'idle';
            script.remove();
        },
        { once: true },
    );
    document.head.appendChild(script);

    return true;
}

/**
 * Records the visitor's answer, then loads or silences analytics right away.
 * Both answers are equally easy: one call, no confirmation.
 */
export function setConsent(consent: AnalyticsConsent): void {
    writeConsent(consent);

    if (consent === 'granted') {
        loadAnalytics();
    } else {
        const id = getMeasurementId();
        if (id) setOptOut(id, true);
    }

    notifyListeners();
}

/**
 * Sends one page view. Pure on purpose: it returns false — and sends nothing —
 * unless the visitor agreed and gtag has been bootstrapped.
 */
export function sendPageView(url: string, context: PageViewContext): boolean {
    if (context.consent !== 'granted' || !context.loaded) return false;
    if (!context.id || typeof context.gtag !== 'function') return false;

    // Path only: query strings carry search terms, room codes and route ids.
    const pagePath = pathnameOf(url);

    context.gtag('config', context.id, {
        page_path: pagePath,
        // GA4 reads the full URL from page_location, so strip it there too.
        page_location: context.origin + pagePath,
    });

    return true;
}

/** Page-view tracking for an Inertia navigation; no-ops without consent. */
export function trackPageView(url: string): boolean {
    const w = browserWindow();
    if (!w) return false;

    return sendPageView(url, {
        consent: currentConsent(),
        loaded: analyticsLoaded(),
        id: getMeasurementId(),
        origin: w.location.origin,
        gtag: w.gtag,
    });
}

/**
 * Reactive consent for components. null on the server and on the first client
 * render, which is also what keeps SSR and hydration identical.
 */
export function useAnalyticsConsent(): AnalyticsConsent | null {
    const [consent, setLocal] = useState<AnalyticsConsent | null>(null);

    useEffect(() => {
        setLocal(currentConsent());
        return subscribeConsent(setLocal);
    }, []);

    return consent;
}

/** Reactive measurement id; null until mounted, so SSR renders the same HTML. */
export function useMeasurementId(): string | null {
    const [id, setId] = useState<string | null>(null);

    useEffect(() => {
        setId(getMeasurementId());
    }, []);

    return id;
}

/** Reactive privacy signal; false until mounted, so SSR renders the same HTML. */
export function usePrivacySignal(): boolean {
    const [denied, setDenied] = useState(false);

    useEffect(() => {
        setDenied(deniedByPrivacySignal());
    }, []);

    return denied;
}

/**
 * Reactive "the consent card is on screen"; false on the server and on the first
 * client render. A first-visit overlay subscribes to this instead of reading the
 * card's DOM or its storage key.
 */
export function useConsentBannerPending(): boolean {
    const [pending, setPending] = useState(false);

    useEffect(() => {
        const read = () => setPending(consentBannerPending());
        read();
        return subscribeConsent(read);
    }, []);

    return pending;
}
