import { DATA_TYPE_CONFIG, type DataType } from '../constants/data-config';

export function getColor(
  value: number,
  dataType: DataType,
  thresholds: readonly number[],
): string {
  const config = DATA_TYPE_CONFIG[dataType];
  if (value === 0) {
    return config.colors.none;
  }
  if (value > (thresholds[2] ?? Number.POSITIVE_INFINITY)) {
    return config.colors.high;
  }
  if (value > (thresholds[1] ?? Number.POSITIVE_INFINITY)) {
    return config.colors.medium;
  }
  return config.colors.low;
}

export function getTemperatureColor(temperature: number): string {
  if (temperature <= 5) {
    return '#60a5fa';
  }
  if (temperature <= 10) {
    return '#22d3ee';
  }
  if (temperature <= 15) {
    return '#2dd4bf';
  }
  if (temperature <= 20) {
    return '#4ade80';
  }
  if (temperature <= 25) {
    return '#facc15';
  }
  if (temperature <= 30) {
    return '#fb923c';
  }
  return '#f87171';
}

/*
PORT STATUS
  source:     resources/js/Pages/Population/utils/color-calculator.ts (12 lines)
  confidence: high
  todos:      0
  notes:      Source thresholds and the climate temperature scale are pure native map inputs.
*/
