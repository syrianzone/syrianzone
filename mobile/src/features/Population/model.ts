import {
  getCanonicalCityName,
  sortCitiesByOrder,
  standardizeCityNames,
} from '@/lib/ported/city-name-standardizer';

import {
  DATA_TYPE_CONFIG,
  type DataType,
} from './constants/data-config';
import type {
  DataSource,
  EnvironmentalReport,
  PopulationCollection,
  PopulationFeature,
  PopulationGroups,
  PopulationMasterData,
  RainfallYear,
} from './types';
import { getColor, getTemperatureColor } from './utils/color-calculator';
import {
  featureDisplayName,
  findEnvironmentalData,
  findPopulation,
  findRainData,
} from './utils/data-finder';

export const COMPARISON_TYPES = [
  'population',
  'idp',
  'idp_returnees',
] as const satisfies readonly DataType[];

export type ComparisonDataType = (typeof COMPARISON_TYPES)[number];

export interface ComparisonRow {
  first: number;
  label: string;
  max: number;
  second: number;
  type: ComparisonDataType;
}

export interface GovernorateComparison {
  first: { name: string };
  rows: readonly ComparisonRow[];
  second: { name: string };
}

interface AtlasCollectionInput {
  boundaries: PopulationCollection;
  dataType: DataType;
  environment: EnvironmentalReport;
  master: PopulationMasterData;
  source: DataSource | null;
}

export function rainfallYearForMap(
  years: readonly RainfallYear[],
): RainfallYear | null {
  return (
    years.find((item) => item.year === 2024) ??
    years.reduce<RainfallYear | null>(
      (latest, item) => (!latest || item.year > latest.year ? item : latest),
      null,
    )
  );
}

export function thresholdsForSource(
  dataType: DataType,
  source: DataSource | null,
): readonly [number, number, number] {
  const fallback = DATA_TYPE_CONFIG[dataType].thresholds;
  if (
    dataType === 'rainfall' ||
    dataType === 'environmental' ||
    !source
  ) {
    return fallback;
  }
  const values = Object.values(source.cities).filter((value) => value > 0);
  const max = values.length > 0 ? Math.max(...values) : 0;
  return max > 0
    ? [Math.floor(max * 0.1), Math.floor(max * 0.4), Math.floor(max * 0.7)]
    : fallback;
}

export function atlasValue(
  feature: PopulationFeature,
  dataType: DataType,
  source: DataSource | null,
  master: PopulationMasterData,
  environment: EnvironmentalReport,
): number | null {
  if (dataType === 'rainfall') {
    const years = findRainData(feature, master.rainfall_data);
    return years ? rainfallYearForMap(years)?.rainfall ?? null : null;
  }
  if (dataType === 'environmental') {
    return (
      findEnvironmentalData(feature, environment)?.current_conditions
        .temperature_celsius ?? null
    );
  }
  return findPopulation(featureDisplayName(feature, 'ar'), source?.cities ?? null);
}

export function buildAtlasCollection({
  boundaries,
  dataType,
  environment,
  master,
  source,
}: AtlasCollectionInput): PopulationCollection {
  const thresholds = thresholdsForSource(dataType, source);
  return {
    ...boundaries,
    features: boundaries.features.map((feature) => {
      const value = atlasValue(feature, dataType, source, master, environment);
      const color =
        value === null
          ? DATA_TYPE_CONFIG[dataType].colors.none
          : dataType === 'environmental'
            ? getTemperatureColor(value)
            : getColor(value, dataType, thresholds);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          atlasColor: color,
          atlasNameAr: featureDisplayName(feature, 'ar'),
          atlasNameEn: featureDisplayName(feature, 'en'),
          atlasValue: value,
        },
      };
    }),
  };
}

export function comparisonGovernorates(
  current: readonly string[],
  province: string,
): string[] {
  const canonical = getCanonicalCityName(province);
  if (current.includes(canonical)) {
    return current.filter((item) => item !== canonical);
  }
  return [...current.slice(-1), canonical];
}

export function governorateEntries(
  source: DataSource | null,
): readonly [string, number][] {
  if (!source) {
    return [];
  }
  return sortCitiesByOrder(Object.entries(standardizeCityNames(source.cities)));
}

export function buildGovernorateComparison(
  groups: PopulationGroups,
  selected: readonly string[],
  sourceOverrides: Partial<Record<ComparisonDataType, DataSource>> = {},
): GovernorateComparison | null {
  const firstName = selected[0];
  const secondName = selected[1];
  if (!firstName || !secondName) {
    return null;
  }

  const rows = COMPARISON_TYPES.map((type): ComparisonRow => {
    const source = sourceOverrides[type] ?? groups[type][0] ?? null;
    const first = findPopulation(firstName, source?.cities ?? null);
    const second = findPopulation(secondName, source?.cities ?? null);
    return {
      first,
      label: DATA_TYPE_CONFIG[type].labelAr,
      max: Math.max(first, second, 1),
      second,
      type,
    };
  });

  return {
    first: { name: firstName },
    rows,
    second: { name: secondName },
  };
}

/*
PORT STATUS
  source:     resources/js/Pages/Population/PopulationClient.tsx (996 lines)
  confidence: high
  todos:      0
  notes:      Map values, source thresholds, and two-governorate comparison stay deterministic and testable.
*/
