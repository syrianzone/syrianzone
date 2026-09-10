// Last-visited page tracking (device-local) for the homepage "recent" badge.
// Policy: always show the single most recent page; visiting home (/) itself
// must never overwrite it. External sites cannot be recorded (no code runs
// there), so only in-app paths ever land here.
const KEY = 'sz-last-page';

export function normalizePath(href: string): string {
    try {
        const base = typeof window !== 'undefined' ? window.location.origin : 'https://syrian.zone';
        const u = new URL(href, base);
        return u.pathname.replace(/\/+$/, '') || '/';
    } catch {
        return href.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    }
}

export function recordVisit(path: string): void {
    try {
        if (typeof window === 'undefined') return;
        const clean = normalizePath(path);
        if (clean === '/') return;
        localStorage.setItem(KEY, JSON.stringify({ href: clean, at: Date.now() }));
    } catch {}
}

export function getLastPage(): string | null {
    try {
        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return typeof parsed?.href === 'string' ? parsed.href : null;
    } catch {
        return null;
    }
}
