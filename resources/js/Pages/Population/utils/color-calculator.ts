import { DataType, DATA_TYPES } from '../types';
import { DATA_TYPE_CONFIG, TEMPERATURE_BANDS, type ScaleBand } from '../constants/data-config';

export interface LegendEntry {
    label: string;
    color: string;
}

const NO_DATA_LABEL = 'لا توجد بيانات';

function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)} م`;
    if (n >= 1_000) return `${Math.round(n / 1_000)} ألف`;
    return `${n}`;
}

/**
 * The three value bands of `kind: 'value'`, as data: `low` holds everything up
 * to `thresholds[1]` inclusive, `medium` up to `thresholds[2]`, `high` the rest.
 * `getColor` and `buildLegend` both read this, so a legend can never describe a
 * boundary the map does not draw.
 */
function valueBands(dataType: DataType, thresholds: number[]): ScaleBand[] {
    const config = DATA_TYPE_CONFIG[dataType];
    const [low, medium] = [thresholds[1], thresholds[2]];
    const unit = dataType === DATA_TYPES.RAINFALL ? ' مم' : '';
    const colors = config.kind === 'value' ? config.colors : null;
    if (!colors) return [];
    return [
        {
            max: low,
            maxInclusive: true,
            color: colors.low,
            label: `حتى ${formatCompact(low)}${unit}`,
        },
        {
            max: medium,
            maxInclusive: true,
            color: colors.medium,
            label: `${formatCompact(low)} – ${formatCompact(medium)}${unit}`,
        },
        {
            max: null,
            maxInclusive: true,
            color: colors.high,
            label: `أكثر من ${formatCompact(medium)}${unit}`,
        },
    ];
}

/** The temp bands since the scale is fixed: cold is below 10, mild ends at 20, … */
function bandColor(bands: ScaleBand[], value: number): string | null {
    for (const band of bands) {
        if (band.max === null) return band.color;
        if (value < band.max) return band.color;
        if (band.maxInclusive && value === band.max) return band.color;
    }
    return null;
}

/**
 * The colour of one value on a data type's scale. `thresholds` is passed
 * separately because the page replaces the table's bands with thresholds
 * derived from the live data; the legend is built from the same argument.
 */
export function getColor(value: number, dataType: DataType, thresholds: number[]): string {
    const config = DATA_TYPE_CONFIG[dataType];
    if (!config) return '#2a3033';

    if (config.kind === 'bands') {
        if (!Number.isFinite(value)) return config.colors.none;
        return bandColor(config.bands, value) ?? config.colors.none;
    }

    if (!Number.isFinite(value) || value === 0) return config.colors.none;
    return bandColor(valueBands(dataType, thresholds), value) ?? config.colors.none;
}

/** Temperature fill for the environmental layer, from its single band table. */
export function getTemperatureColor(temperature: number): string {
    return bandColor(TEMPERATURE_BANDS, temperature) ?? TEMPERATURE_BANDS[TEMPERATURE_BANDS.length - 1].color;
}

/**
 * The legend for exactly the bands the map colours with. The entries and the
 * thresholds come from the same table (`valueBands` / the fixed `bands`), so
 * "أكثر من ٥٠٠ ألف" cannot appear beside a map that starts its top band at one
 * million.
 */
export function buildLegend(dataType: DataType, thresholds: number[]): LegendEntry[] {
    const config = DATA_TYPE_CONFIG[dataType];
    if (!config) return [];
    const bands = config.kind === 'bands' ? config.bands : valueBands(dataType, thresholds);
    return [
        { label: NO_DATA_LABEL, color: config.colors.none },
        ...bands.map((band) => ({ label: band.label, color: band.color })),
    ];
}
