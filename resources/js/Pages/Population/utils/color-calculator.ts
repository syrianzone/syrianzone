import { DataType } from '../types';
import { DATA_TYPE_CONFIG } from '../constants/data-config';

export function getColor(value: number, dataType: DataType, thresholds: number[]): string {
    const config = DATA_TYPE_CONFIG[dataType as keyof typeof DATA_TYPE_CONFIG];
    if (!config) return '#2a3033';

    if (value === 0) return config.colors.none;
    if (value > thresholds[2]) return config.colors.high;
    if (value > thresholds[1]) return config.colors.medium;
    if (value > thresholds[0]) return config.colors.low;
    return config.colors.low;
}