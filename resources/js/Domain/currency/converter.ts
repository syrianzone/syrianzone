import { NEW_NOTE_VALUES, OLD_PER_NEW_RATIO } from './facts';

export type ConvertDirection = 'old-to-new' | 'new-to-old';

export interface BreakdownRow {
    denomination: number;
    count: number;
    subtotal: number;
}

export interface BreakdownResult {
    target: number;
    payable: number;
    remainder: number;
    totalNotes: number;
    exact: boolean;
    rows: BreakdownRow[];
}

const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0;

const WESTERN_FORMATTER = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
});

const WESTERN_INT_FORMATTER = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
});

function roundDecimal(value: number, places = 6): number {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** places;
    const rounded = Math.round((value + Math.sign(value) * 1e-12) * factor) / factor;
    return Object.is(rounded, -0) ? 0 : rounded;
}

function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x || 1;
}

/**
 * Convert Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits to ASCII
 * digits while leaving all other characters intact.
 */
export function normalizeDigits(input: string): string {
    return input.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => {
        const code = ch.charCodeAt(0);
        if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
            return String(code - ARABIC_INDIC_ZERO);
        }
        return String(code - EASTERN_ARABIC_INDIC_ZERO);
    });
}

/**
 * Parse a user-entered monetary amount supporting Arabic-Indic and Western
 * digits, thousands separators (`,`, `٬`, `_`, spaces) and decimal points (`.`, `٫`).
 *
 * Returns `null` for empty, negative, non-numeric, or unsafe/non-finite inputs.
 */
export function parseAmount(raw: string): number | null {
    if (typeof raw !== 'string') return null;

    const normalized = normalizeDigits(raw)
        .trim()
        // Strip thousands separators and whitespace: spaces, NBSP, thin space, ASCII comma, Arabic thousands sep, underscore.
        .replace(/[\s\u00A0\u2009,\u066C_]+/g, '')
        // Normalize Arabic decimal separator (٫) to ASCII dot.
        .replace(/\u066B/g, '.');

    if (normalized === '' || !/^\d+(?:\.\d+)?$/.test(normalized)) {
        return null;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > Number.MAX_SAFE_INTEGER) {
        return null;
    }

    return parsed;
}

/**
 * Convert between old SYP (pre-2026) and new SYP (2026 redenomination: 100 old = 1 new).
 */
export function convert(amount: number, direction: ConvertDirection): number {
    if (!Number.isFinite(amount) || amount <= 0) {
        return 0;
    }

    if (direction === 'old-to-new') {
        return roundDecimal(amount / OLD_PER_NEW_RATIO, 6);
    }

    return roundDecimal(amount * OLD_PER_NEW_RATIO, 4);
}

/**
 * Format a number with thousands grouping and Western digits (0-9) (e.g. `10,000.5`).
 */
export function formatCurrencyNumber(value: number, maxFractionDigits = 4): string {
    if (!Number.isFinite(value)) return WESTERN_FORMATTER.format(0);
    if (maxFractionDigits === 0) {
        return WESTERN_INT_FORMATTER.format(Math.round(value));
    }
    if (maxFractionDigits === 4) {
        return WESTERN_FORMATTER.format(value);
    }
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: maxFractionDigits,
    }).format(value);
}

/**
 * Compute the fewest-notes payment breakdown for a target amount in new SYP
 * using dynamic programming (minimum coin change).
 *
 * Unlike a greedy algorithm, DP solves cases such as 30 = 10 + 10 + 10 instead
 * of failing on 25 + remainder 5. When the target cannot be matched exactly
 * (e.g. 5, 15, non-multiples of 5, or fractional piastres), returns the largest
 * payable amount <= target together with the remaining unpayable difference.
 */
export function breakdown(
    newAmount: number,
    denominations: readonly number[] = NEW_NOTE_VALUES,
): BreakdownResult {
    if (!Number.isFinite(newAmount) || newAmount < 0) {
        return {
            target: 0,
            payable: 0,
            remainder: 0,
            totalNotes: 0,
            exact: false,
            rows: [],
        };
    }

    if (newAmount === 0) {
        return {
            target: 0,
            payable: 0,
            remainder: 0,
            totalNotes: 0,
            exact: true,
            rows: [],
        };
    }

    const sortedAsc = Array.from(
        new Set(denominations.filter((d) => Number.isInteger(d) && d > 0)),
    ).sort((a, b) => a - b);

    if (sortedAsc.length === 0) {
        return {
            target: newAmount,
            payable: 0,
            remainder: roundDecimal(newAmount, 6),
            totalNotes: 0,
            exact: false,
            rows: [],
        };
    }

    const unit = sortedAsc.reduce((acc, d) => gcd(acc, d), sortedAsc[0]);
    const stepDenoms = sortedAsc.map((d) => d / unit);
    const maxDenom = sortedAsc[sortedAsc.length - 1];
    const maxStep = stepDenoms[stepDenoms.length - 1];

    const maxPayableUnits = Math.floor(newAmount / unit + 1e-11);
    if (maxPayableUnits <= 0) {
        return {
            target: newAmount,
            payable: 0,
            remainder: roundDecimal(newAmount, 6),
            totalNotes: 0,
            exact: false,
            rows: [],
        };
    }

    // Keep a bounded DP tail for arbitrarily large inputs: peeling excess
    // max-denomination notes above 2 * maxDenom leaves a tail in [maxDenom, 2 * maxDenom - 1]
    // so breaking one 500-note into smaller denominations (e.g. 505, 515) stays optimal.
    const dpCapUnits = Math.max(maxStep * 2, 200);
    let extraMaxNotes = 0;
    let tailUnits = maxPayableUnits;

    if (maxPayableUnits > dpCapUnits) {
        extraMaxNotes = Math.floor((maxPayableUnits - dpCapUnits) / maxStep) + 1;
        tailUnits = maxPayableUnits - extraMaxNotes * maxStep;
    }

    const dp = new Int32Array(tailUnits + 1);
    const choice = new Int32Array(tailUnits + 1);
    const INF = 0x3fffffff;
    dp.fill(INF);
    choice.fill(-1);
    dp[0] = 0;

    // Iterate denominations descending so ties prefer larger notes.
    for (let dIdx = stepDenoms.length - 1; dIdx >= 0; dIdx--) {
        const coin = stepDenoms[dIdx];
        for (let u = coin; u <= tailUnits; u++) {
            const candidate = dp[u - coin] + 1;
            if (candidate < dp[u]) {
                dp[u] = candidate;
                choice[u] = dIdx;
            }
        }
    }

    let bestUnits = tailUnits;
    while (bestUnits > 0 && dp[bestUnits] >= INF) {
        bestUnits--;
    }

    const counts = new Map<number, number>();
    if (extraMaxNotes > 0) {
        counts.set(maxDenom, extraMaxNotes);
    }

    let cursor = bestUnits;
    while (cursor > 0 && choice[cursor] !== -1) {
        const dIdx = choice[cursor];
        const denom = sortedAsc[dIdx];
        counts.set(denom, (counts.get(denom) ?? 0) + 1);
        cursor -= stepDenoms[dIdx];
    }

    const payable = bestUnits * unit + extraMaxNotes * maxDenom;
    const remainder = roundDecimal(newAmount - payable, 6);

    const rows: BreakdownRow[] = sortedAsc
        .slice()
        .reverse()
        .filter((denom) => (counts.get(denom) ?? 0) > 0)
        .map((denom) => {
            const count = counts.get(denom) ?? 0;
            return {
                denomination: denom,
                count,
                subtotal: denom * count,
            };
        });

    const totalNotes = rows.reduce((sum, r) => sum + r.count, 0);

    return {
        target: newAmount,
        payable,
        remainder,
        totalNotes,
        exact: remainder === 0,
        rows,
    };
}
