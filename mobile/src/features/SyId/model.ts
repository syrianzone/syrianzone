import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';

import { getGovernorateNameAr } from '@/lib/ported/geo-utils';

export interface ProvinceProperties {
  name?: string;
  province_name?: string;
  [key: string]: unknown;
}

export type ProvinceFeature = Feature<MultiPolygon | Polygon, ProvinceProperties>;
export type ProvinceCollection = FeatureCollection<
  MultiPolygon | Polygon,
  ProvinceProperties
>;

export interface GovernorateOption {
  id: string;
  nameAr: string;
}

export const syrianIdentityPalettes = [
  {
    colors: [
      { cmyk: 'C76% M32% Y54% K10%', hex: '#428177', textColor: 'white' },
      { cmyk: 'C89% M49% Y70% K50%', hex: '#054239', textColor: 'white' },
      { cmyk: 'C87% M59% Y68% K71%', hex: '#002623', textColor: 'white' },
    ],
    name: 'Forest',
  },
  {
    colors: [
      { cmyk: 'C6% M9% Y19% K0%', hex: '#edebe0', textColor: 'black' },
      { cmyk: 'C20% M29% Y52% K7%', hex: '#b9a779', textColor: 'black' },
      { cmyk: 'C39% M46% Y67% K20%', hex: '#988561', textColor: 'white' },
    ],
    name: 'Golden Wheat',
  },
  {
    colors: [
      { cmyk: 'C35% M92% Y72% K46%', hex: '#6b1f2a', textColor: 'white' },
      { cmyk: 'C44% M86% Y68% K65%', hex: '#4a151e', textColor: 'white' },
      { cmyk: 'C60% M75% Y64% K79%', hex: '#260f14', textColor: 'white' },
    ],
    name: 'Deep Umber',
  },
  {
    colors: [
      { cmyk: 'C0% M0% Y0% K0%', hex: '#ffffff', textColor: 'black' },
      { cmyk: 'C67% M53% Y60% K50%', hex: '#3d3a3b', textColor: 'white' },
      { cmyk: 'C73% M67% Y65% K80%', hex: '#161616', textColor: 'white' },
    ],
    name: 'Charcoal',
  },
] as const;

export function provinceId(feature: ProvinceFeature): string {
  return feature.properties.province_name ?? feature.properties.name ?? '';
}

export function governorateOptions(data: ProvinceCollection): GovernorateOption[] {
  return data.features
    .map((feature) => provinceId(feature))
    .filter(Boolean)
    .map((id) => ({ id, nameAr: getGovernorateNameAr(id) }))
    .sort((left, right) => left.nameAr.localeCompare(right.nameAr, 'ar'));
}

export function filterGovernorates(
  options: readonly GovernorateOption[],
  search: string,
): GovernorateOption[] {
  const query = search.trim();
  return query ? options.filter((option) => option.nameAr.includes(query)) : [...options];
}

export function selectProvince(
  data: ProvinceCollection,
  selectedId: string,
): ProvinceCollection {
  if (!selectedId || selectedId === 'full') {
    return data;
  }
  return {
    ...data,
    features: data.features.filter((feature) => provinceId(feature) === selectedId),
  };
}

function allPositions(feature: ProvinceFeature): Position[] {
  return feature.geometry.type === 'Polygon'
    ? feature.geometry.coordinates.flat()
    : feature.geometry.coordinates.flat(2);
}

export function provinceBounds(data: ProvinceCollection): [number, number, number, number] {
  const positions = data.features.flatMap(allPositions);
  const longitudes = positions.map((position) => position[0] ?? 0);
  const latitudes = positions.map((position) => position[1] ?? 0);
  if (!positions.length) {
    return [35.7, 32.3, 42.4, 37.4];
  }
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

export function isProvinceCollection(value: unknown): value is ProvinceCollection {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { features?: unknown; type?: unknown };
  if (candidate.type !== 'FeatureCollection' || !Array.isArray(candidate.features)) {
    return false;
  }
  return candidate.features.every((rawFeature) => {
    if (typeof rawFeature !== 'object' || rawFeature === null) {
      return false;
    }
    const feature = rawFeature as {
      geometry?: { coordinates?: unknown; type?: unknown };
      properties?: unknown;
      type?: unknown;
    };
    return (
      feature.type === 'Feature' &&
      (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') &&
      Array.isArray(feature.geometry.coordinates) &&
      typeof feature.properties === 'object' &&
      feature.properties !== null
    );
  });
}
