import data from '../_data/crossings.json';

export type WorkWindow = { label?: string; start?: string; end?: string; h24?: boolean };

export type Direction = 'north' | 'west' | 'east' | 'south' | 'sea';

export type Crossing = {
    n: number;
    name: string;
    intl: string;
    category: 'crossing' | 'port';
    /** The neighbouring country; null for the maritime ports. */
    country: string | null;
    direction: Direction;
    lat: number;
    lon: number;
    opType: string | null;
    windows: WorkWindow[];
    mapsUrl: string;
    openingSoon: boolean;
    override: { status?: 'open' | 'closed'; message?: string } | null;
};

export type Status = 'open' | 'closed' | 'opening' | 'pending';

export const { meta, crossings } = data as {
    meta: { source: string; sourceUrl: string; asOf: string };
    crossings: Crossing[];
};

/**
 * TODO(official-portal): the authority's own page is not published yet. The one
 * below is the interim source this dataset came from, and it is the ONLY place
 * that URL appears — swap it for the official domain once the portal is live,
 * and drop the "(مؤقتاً)" wording where this is rendered in Index.tsx.
 */
export const SOURCE_PAGE_URL = 'https://syria-border-crossings.vercel.app/';

/** The country-wide view the map opens on, and returns to when a card closes. */
export const DEFAULT_CENTER: [number, number] = [38.0, 35.0];
export const DEFAULT_ZOOM = 6.1;
/** Close enough to read one crossing's surroundings without losing the border. */
export const CROSSING_ZOOM = 9;

export const DIRECTION_LABELS: Record<Direction, string> = {
    north: 'المنافذ الشمالية',
    west: 'المنافذ الغربية',
    east: 'المنافذ الشرقية',
    south: 'المنافذ الجنوبية',
    sea: 'المرافئ البحرية',
};

/** Groups run clockwise from the Turkish border, with the ports last. */
export const DIRECTION_ORDER: Direction[] = ['north', 'west', 'east', 'south', 'sea'];

// Syria sits on GMT+3 all year (no DST since 2022), so the offset is a constant
// rather than something we have to look up per date.
const SYRIA_OFFSET_MINUTES = 3 * 60;

export function syriaNow(): Date {
    const now = new Date();
    return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + SYRIA_OFFSET_MINUTES * 60000);
}

/** Minutes since midnight, Syria time. */
export function syriaMinutes(): number {
    const now = syriaNow();
    return now.getHours() * 60 + now.getMinutes();
}

function timeToMinutes(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function formatTime12(t: string) {
    const [h, mm] = t.split(':').map(Number);
    const period = h < 12 ? 'ص' : 'م';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

export function windowLabel(win: WorkWindow) {
    if (win.h24) return 'على مدار الساعة';
    return `${formatTime12(win.start!)} – ${formatTime12(win.end!)}`;
}

export function isWindowOpen(win: WorkWindow, nowMin: number) {
    if (win.h24) return true;
    const start = timeToMinutes(win.start!);
    const end = timeToMinutes(win.end!);
    if (start === end) return true;
    if (start < end) return nowMin >= start && nowMin < end;
    // window that runs past midnight, e.g. 09:00 – 05:00
    return nowMin >= start || nowMin < end;
}

export function isOpenNow(c: Crossing, nowMin: number) {
    if (c.override?.status) return c.override.status === 'open';
    return c.windows.some((win) => isWindowOpen(win, nowMin));
}

/**
 * nowMin is null until the page has mounted, which is why 'pending' exists: the
 * first paint must not claim a status resolved against a clock we do not have.
 */
export function statusOf(c: Crossing, nowMin: number | null): Status {
    if (c.openingSoon) return 'opening';
    if (nowMin === null) return 'pending';
    return isOpenNow(c, nowMin) ? 'open' : 'closed';
}

export const STATUS_TEXT: Record<Status, string> = {
    open: 'مفتوح الآن',
    closed: 'مغلق الآن',
    opening: 'قيد الافتتاح',
    pending: 'جارٍ التحقق',
};

/** Hex rather than tailwind tokens: the map paints circles, not DOM nodes. */
export const STATUS_COLORS: Record<Status, string> = {
    open: '#10b981',
    closed: '#ef4444',
    opening: '#f59e0b',
    pending: '#94a3b8',
};

/** 963989860267 -> +963 989 860 267 */
export function formatIntl(intl: string) {
    return `+${intl.slice(0, 3)} ${intl.slice(3, 6)} ${intl.slice(6, 9)} ${intl.slice(9)}`;
}

export function buildShareMessage(c: Crossing, open: boolean) {
    const lines = [`🛂 ${c.name}`];

    if (c.openingSoon) {
        lines.push('🟡 قيد الافتتاح');
    } else {
        lines.push(open ? '🟢 مفتوح الآن' : '🔴 مغلق الآن');
        if (c.opType) lines.push(`🚦 ${c.opType}`);
        c.windows.forEach((win) => {
            const label = win.label ? `${win.label}: ` : 'ساعات العمل: ';
            lines.push(`🕘 ${label}${windowLabel(win)}`);
        });
    }

    if (c.country) lines.push(`🌍 الدولة المقابلة: ${c.country}`);
    lines.push(`📞 واتساب: ${formatIntl(c.intl)}`);
    lines.push(`📍 الموقع: ${c.mapsUrl}`);
    lines.push('');
    lines.push(`🔗 التفاصيل: ${window.location.origin}/crossings?c=${c.n}`);
    lines.push('عبر المساحة السورية 🇸🇾');

    return lines.join('\n');
}

export async function shareCrossing(c: Crossing) {
    // Resolved here rather than read from render state: the caller's copy is up
    // to 30s stale, and a shared message should state the status at the instant
    // it was shared.
    const text = buildShareMessage(c, isOpenNow(c, syriaMinutes()));

    if (navigator.share) {
        try {
            await navigator.share({ title: c.name, text });
            return;
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;
        }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

export function toFeatureCollection(list: Crossing[], nowMin: number | null): GeoJSON.FeatureCollection {
    return {
        type: 'FeatureCollection',
        features: list.map((c) => ({
            type: 'Feature',
            id: c.n,
            geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
            properties: {
                n: c.n,
                name: c.name,
                color: STATUS_COLORS[statusOf(c, nowMin)],
                status: STATUS_TEXT[statusOf(c, nowMin)],
            },
        })),
    };
}
