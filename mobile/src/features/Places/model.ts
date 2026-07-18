import type { PlaceCategory, PlaceFeatureCollection } from './_lib/types';

export function filterPlaceFeatures(data: PlaceFeatureCollection | null | undefined, category: PlaceCategory | null, query: string): PlaceFeatureCollection {
  const search = query.trim();
  return {
    features: (data?.features ?? []).filter((feature) => (category === null || feature.properties.category === category) && (!search || feature.properties.name.includes(search))),
    type: 'FeatureCollection',
  };
}
