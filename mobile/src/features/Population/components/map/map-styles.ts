import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import type { DataType } from '../../constants/data-config';
import { getColor, getTemperatureColor } from '../../utils/color-calculator';

export function provinceFillColor(value: number, type: DataType, thresholds: readonly number[]): string {
  return type === 'environmental' ? getTemperatureColor(value) : getColor(value, type, thresholds);
}

export const populationMapStyle = {
  layers: [{ id: 'background', paint: { 'background-color': '#0f172a' }, type: 'background' }],
  sources: {},
  version: 8,
} satisfies StyleSpecification;

/*
PORT STATUS
  source:     resources/js/Pages/Population/components/map/map-styles.ts (134 lines)
  confidence: high
  todos:      0
  notes:      Native MapLibre consumes the same calculated thematic colors with an offline background.
*/
