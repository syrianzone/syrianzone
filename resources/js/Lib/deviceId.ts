/**
 * A stable, random per-browser id for guest actions that must count once
 * (tier-list ballots, promise votes). Created on first use and kept in
 * localStorage. Returns null when storage is unavailable (private mode,
 * blocked site data). Call it from event handlers or effects, never during
 * render: it touches browser-only APIs.
 */
export function getDeviceId(): string | null {
    try {
        const existing = localStorage.getItem('deviceId');
        if (existing) return existing;
        const created = crypto.randomUUID();
        localStorage.setItem('deviceId', created);
        return created;
    } catch {
        return null;
    }
}
