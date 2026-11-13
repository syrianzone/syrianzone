export const DATA_TYPES = {
    POPULATION: 'population',
    IDP: 'idp',
    IDP_RETURNEES: 'idp_returnees',
    RAINFALL: 'rainfall',
    ENVIRONMENTAL: 'environmental'
} as const;

export type DataType = typeof DATA_TYPES[keyof typeof DATA_TYPES];

/**
 * A band of a colour scale. `max` is the last value it holds; `maxInclusive`
 * says whether a value equal to `max` belongs to it or to the next band. The
 * label is the legend text for exactly this band, so the two cannot drift.
 */
export interface ScaleBand {
    max: number | null;
    maxInclusive: boolean;
    color: string;
    label: string;
}

/**
 * The choropleth palette and classification for one data type.
 *
 * `kind: 'value'` is the generic three-band model: the legend labels are built
 * from the *same* `thresholds` array the map colours with (and the page may
 * replace both at once with data-driven thresholds). `kind: 'bands'` is a scale
 * whose boundaries are fixed in the data itself (temperature), not per render.
 */
export type ValueScale = {
    kind: 'value';
    label: string;
    labelAr: string;
    colors: { none: string; low: string; medium: string; high: string };
    /** [unused lower bound kept for the source UI, low/medium edge, medium/high edge] */
    thresholds: [number, number, number];
};

export type BandScale = {
    kind: 'bands';
    label: string;
    labelAr: string;
    colors: { none: string };
    thresholds: [number, number, number];
    bands: ScaleBand[];
};

export type DataTypeConfig = ValueScale | BandScale;

const NO_DATA_COLOR = '#1e293b';

/**
 * Temperature bands, cool to hot. Fixed by the data (degrees), not by the
 * current source, so this is the single table behind the environmental fill,
 * its legend and the tooltip's temperature number.
 */
export const TEMPERATURE_BANDS: ScaleBand[] = [
    { max: 10, maxInclusive: false, color: '#3b82f6', label: 'بارد (< 10°)' },
    { max: 20, maxInclusive: true, color: '#22c55e', label: 'معتدل (10°-20°)' },
    { max: 30, maxInclusive: true, color: '#eab308', label: 'دافئ (20°-30°)' },
    { max: null, maxInclusive: true, color: '#ef4444', label: 'حار (> 30°)' },
];

/** Traffic-light colours the environmental tooltip shares between AQI and drought. */
export const STATUS_COLORS = {
    good: '#22c55e',
    warning: '#eab308',
    serious: '#f97316',
    critical: '#ef4444',
};

export const DATA_TYPE_CONFIG: Record<DataType, DataTypeConfig> = {
    [DATA_TYPES.POPULATION]: {
        kind: 'value',
        label: 'عدد السكان',
        labelAr: 'السكان',
        // Vibrant Blues
        colors: { none: NO_DATA_COLOR, low: '#3b82f6', medium: '#6366f1', high: '#8b5cf6' },
        thresholds: [100000, 500000, 1000000],
    },
    [DATA_TYPES.IDP]: {
        kind: 'value',
        label: 'النازحين داخلياً',
        labelAr: 'النازحين',
        // Bright Oranges/Reds
        colors: { none: NO_DATA_COLOR, low: '#f97316', medium: '#ea580c', high: '#ef4444' },
        thresholds: [100000, 500000, 1000000],
    },
    [DATA_TYPES.IDP_RETURNEES]: {
        kind: 'value',
        label: 'العائدون من النزوح',
        labelAr: 'العائدون',
        // Neon Greens
        colors: { none: NO_DATA_COLOR, low: '#22c55e', medium: '#16a34a', high: '#4ade80' },
        thresholds: [50000, 100000, 200000],
    },
    [DATA_TYPES.RAINFALL]: {
        kind: 'value',
        label: 'معدل الهطول المطري',
        labelAr: 'الأمطار',
        // Electric Cyans
        colors: { none: NO_DATA_COLOR, low: '#22d3ee', medium: '#0ea5e9', high: '#0284c7' },
        thresholds: [100, 300, 500],
    },
    [DATA_TYPES.ENVIRONMENTAL]: {
        kind: 'bands',
        label: 'البيئة والمناخ',
        labelAr: 'الحرارة والمناخ',
        colors: { none: NO_DATA_COLOR },
        thresholds: [10, 20, 30],
        bands: TEMPERATURE_BANDS,
    },
};
