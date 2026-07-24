import { getCanonicalCityName } from '@/lib/ported/city-name-standardizer';

import { ARABIC_TO_ENGLISH_CITY_MAP, PROVINCE_TO_PCODE } from '../constants/province-mappings';
import type {
  CityData,
  EnvironmentalCityData,
  EnvironmentalReport,
  PopulationFeature,
  RainfallData,
  RainfallYear,
} from '../types';
import { normalizeCityName } from './name-normalizer';

export function findPopulation(
  provinceName: string,
  populationData: CityData | null,
): number {
  if (!populationData) {
    return 0;
  }

  const canonicalName = getCanonicalCityName(provinceName);
  const direct = populationData[canonicalName];
  if (direct !== undefined) {
    return direct;
  }

  const normalized = normalizeCityName(provinceName);
  for (const [city, value] of Object.entries(populationData)) {
    if (
      getCanonicalCityName(city) === canonicalName ||
      normalizeCityName(city) === normalized
    ) {
      return value;
    }
  }
  return 0;
}

export function findRainData(
  feature: PopulationFeature,
  rainData: RainfallData | undefined,
): RainfallYear[] | null {
  if (!rainData) {
    return null;
  }

  const properties = feature.properties;
  const codeKeys = [
    'ADM1_PCODE',
    'ADM2_PCODE',
    'admin1Pcode',
    'admin2Pcode',
    'code',
    'id',
    'PCODE',
    'adm1_pcode',
  ] as const;
  for (const key of codeKeys) {
    const code = properties[key];
    if (typeof code === 'string' && rainData[code]) {
      return rainData[code] ?? null;
    }
  }

  const nameKeys = [
    'province_name',
    'ADM1_EN',
    'ADM1_AR',
    'name',
    'Name',
    'NAME',
    'admin1Name_en',
  ] as const;
  for (const key of nameKeys) {
    const name = properties[key];
    if (typeof name !== 'string') {
      continue;
    }
    const mappedCode = PROVINCE_TO_PCODE[normalizeCityName(name)];
    if (mappedCode && rainData[mappedCode]) {
      return rainData[mappedCode] ?? null;
    }
  }
  return null;
}

export function featureName(feature: PopulationFeature): string {
  const properties = feature.properties;
  const value =
    properties.province_name ??
    properties.ADM1_AR ??
    properties.ADM1_EN ??
    properties.Name;
  return typeof value === 'string' ? value : '';
}

export function featureDisplayName(
  feature: PopulationFeature,
  locale: 'ar' | 'en',
): string {
  const rawName = featureName(feature);
  if (locale === 'ar') {
    const arabicName = feature.properties.ADM1_AR;
    return getCanonicalCityName(
      typeof arabicName === 'string' ? arabicName : rawName,
    );
  }
  const englishName = feature.properties.ADM1_EN;
  return typeof englishName === 'string' && englishName
    ? englishName
    : ARABIC_TO_ENGLISH_CITY_MAP[getCanonicalCityName(rawName)] ?? rawName;
}

export function findEnvironmentalData(
  feature: PopulationFeature,
  report: EnvironmentalReport | null | undefined,
): EnvironmentalCityData | null {
  if (!report) {
    return null;
  }
  const rawName = featureName(feature);
  const arabicName = getCanonicalCityName(rawName);
  const englishName = ARABIC_TO_ENGLISH_CITY_MAP[arabicName] ?? rawName;
  return (
    report.cities[arabicName] ??
    report.cities[englishName] ??
    report.cities[rawName] ??
    null
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Population/utils/data-finder.ts (51 lines)
  confidence: high
  todos:      0
  notes:      Pcode, canonical city, rainfall, and environment lookup paths are preserved and typed.
*/
