import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson';
import type { z } from 'zod';

import type {
  cityDataSchema,
  dataSourceSchema,
  environmentalCitySchema,
  environmentalReportSchema,
  populationMasterSchema,
} from '../lib/schemas';

export type CityData = z.infer<typeof cityDataSchema>;
export type DataSource = z.infer<typeof dataSourceSchema>;
export type EnvironmentalCityData = z.infer<typeof environmentalCitySchema>;
export type EnvironmentalReport = z.infer<typeof environmentalReportSchema>;
export type PopulationMasterData = z.infer<typeof populationMasterSchema>;
export type PopulationGroups = PopulationMasterData['groups'];
export type CurrentConditions = EnvironmentalCityData['current_conditions'];
export type DailyForecastSummary = EnvironmentalCityData['daily_forecast_summary'];
export type ClimateTrends = EnvironmentalCityData['climate_trends'];
export type AirQuality = EnvironmentalCityData['air_quality'];
export type DroughtRisk = EnvironmentalCityData['drought_risk'];
export type HistoricalSummary = EnvironmentalCityData['historical_summary'];

export interface PopulationFeatureProperties {
  ADM1_AR?: string;
  ADM1_EN?: string;
  ADM1_PCODE?: string;
  Name?: string;
  atlasColor?: string;
  atlasNameAr?: string;
  atlasNameEn?: string;
  atlasPcode?: string;
  atlasValue?: number | null;
  province_name?: string;
  [key: string]: unknown;
}

export type PopulationFeature = Feature<
  MultiPolygon | Polygon,
  PopulationFeatureProperties
>;
export type PopulationCollection = FeatureCollection<
  MultiPolygon | Polygon,
  PopulationFeatureProperties
>;

/*
PORT STATUS
  source:     resources/js/Pages/Population/types/data-types.ts (21 lines)
  confidence: high
  todos:      0
  notes:      Native contracts type every API and GeoJSON field consumed by the atlas.
*/
