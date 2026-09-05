import { DataType, DATA_TYPES } from '../types';
import { DATA_TYPE_CONFIG } from '../constants/data-config';

export function getColor(value: number, dataType: DataType, thresholds: number[]): string {
    const config = DATA_TYPE_CONFIG[dataType as keyof typeof DATA_TYPE_CONFIG];
    if (!config) return '#2a3033';

    // Buckets (must match the legend generated from the same thresholds):
    // 0 -> none | (0, t1] -> low | (t1, t2] -> medium | > t2 -> high
    // thresholds[0] is kept for compat but is not a color boundary.
    if (value === 0) return config.colors.none;
    if (value > thresholds[2]) return config.colors.high;
    if (value > thresholds[1]) return config.colors.medium;
    return config.colors.low;
}

export function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)} م`;
    if (n >= 1_000) return `${Math.round(n / 1_000)} ألف`;
    return `${n}`;
}

export function buildLegend(dataType: DataType, thresholds: number[]): { label: string; color: string }[] {
    const config = DATA_TYPE_CONFIG[dataType as keyof typeof DATA_TYPE_CONFIG];
    if (!config) return [];
    // Environmental uses 4 temperature bands (cold/mild/warm/hot) via
    // getTemperatureColor(), which does not fit the generic 3-bucket
    // getColor() model — return the static legend so map + legend agree.
    if (dataType === DATA_TYPES.ENVIRONMENTAL) return config.legend;
    const [t1, t2] = [thresholds[1], thresholds[2]];
    const unit = dataType === DATA_TYPES.RAINFALL ? ' مم' : '';
    return [
        { label: 'لا توجد بيانات', color: config.colors.none },
        { label: `أقل من ${formatCompact(t1)}${unit}`, color: config.colors.low },
        { label: `${formatCompact(t1)} – ${formatCompact(t2)}${unit}`, color: config.colors.medium },
        { label: `أكثر من ${formatCompact(t2)}${unit}`, color: config.colors.high },
    ];
}