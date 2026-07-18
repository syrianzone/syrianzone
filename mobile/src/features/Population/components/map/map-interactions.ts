import type { PopulationFeature } from '../../types';
import { featureName } from '../../utils/data-finder';

export function selectedFeatureFromPress(features: readonly unknown[]): PopulationFeature | null {
  const feature = features[0];
  if (!feature || typeof feature !== 'object' || !('properties' in feature)) {
    return null;
  }
  return feature as PopulationFeature;
}

export function toggleComparedProvince(current: readonly string[], feature: PopulationFeature): string[] {
  const name = featureName(feature);
  if (current.includes(name)) {
    return current.filter((item) => item !== name);
  }
  return [...current.slice(-1), name];
}

/*
PORT STATUS
  source:     resources/js/Pages/Population/components/map/map-interactions.ts (93 lines)
  confidence: high
  todos:      0
  notes:      Press selection and the two-province comparison limit remain deterministic native state.
*/
