/**
 * The tier vocabulary: the one record the board renders and the exported image
 * prints. Both surfaces must name and colour the same six tiers, so neither
 * keeps a copy of the labels or the colours.
 */

/** Display order, best first; also the source of `TierKey`. */
export const TIER_KEYS = ['S', 'A', 'B', 'C', 'D', 'F'] as const;

export type TierKey = (typeof TIER_KEYS)[number];

export interface Tier {
    /** The Arabic description, on the board and on the image. */
    arabic: string;
    /** Tailwind class for the label column. */
    labelClass: string;
    /** Tailwind class for the drop area behind the candidates. */
    areaClass: string;
    borderClass: string;
    /** `labelClass` as a literal colour: the canvas renderer has no CSS. */
    color: string;
}

export const TIERS: Record<TierKey, Tier> = {
    S: {
        arabic: 'ممتاز',
        labelClass: 'bg-rose-600',
        areaClass: 'bg-rose-50',
        borderClass: 'border-rose-200',
        color: '#e11d48',
    },
    A: {
        arabic: 'جيد جدًا',
        labelClass: 'bg-amber-600',
        areaClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        color: '#d97706',
    },
    B: {
        arabic: 'جيد',
        labelClass: 'bg-emerald-600',
        areaClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200',
        color: '#059669',
    },
    C: {
        arabic: 'مقبول',
        labelClass: 'bg-sky-600',
        areaClass: 'bg-sky-50',
        borderClass: 'border-sky-200',
        color: '#0284c7',
    },
    D: {
        arabic: 'ضعيف',
        labelClass: 'bg-violet-600',
        areaClass: 'bg-violet-50',
        borderClass: 'border-violet-200',
        color: '#7c3aed',
    },
    F: {
        arabic: 'سيئ',
        labelClass: 'bg-gray-800',
        areaClass: 'bg-gray-100',
        borderClass: 'border-gray-300',
        color: '#1f2937',
    },
};
