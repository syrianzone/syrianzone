import { z } from 'zod';

const finiteNumber = z.number().finite();
const nullableNumber = finiteNumber.nullable().optional();
const nullableString = z.string().nullable().optional();

export const cityDataSchema = z.record(
  z.string().min(1),
  finiteNumber.nonnegative(),
);

export const dataSourceSchema = z
  .object({
    cities: cityDataSchema,
    data_type: z
      .enum(['population', 'idp', 'idp_returnees', 'rainfall', 'environmental'])
      .optional(),
    date: z.string().nullable(),
    note: z.string().nullable(),
    source_id: z.number().int().nonnegative(),
    source_url: z.string().url().nullable(),
  })
  .strict();

export const rainfallYearSchema = z
  .object({
    rainfall: finiteNumber.nonnegative(),
    rainfall_avg: finiteNumber.nonnegative(),
    year: z.number().int(),
  })
  .strict();

export const rainfallDataSchema = z.record(
  z.string().min(1),
  z.array(rainfallYearSchema),
);

const populationGroupsSchema = z
  .object({
    environmental: z.array(dataSourceSchema).default([]),
    idp: z.array(dataSourceSchema).default([]),
    idp_returnees: z.array(dataSourceSchema).default([]),
    population: z.array(dataSourceSchema).default([]),
    rainfall: z.array(dataSourceSchema).default([]),
  })
  .strict();

export const populationMasterSchema = z
  .object({
    groups: populationGroupsSchema,
    rainfall_data: rainfallDataSchema,
  })
  .strict();

const currentConditionsSchema = z
  .object({
    cloud_cover_percent: finiteNumber.min(0).max(100).nullable().optional(),
    feels_like_celsius: nullableNumber,
    humidity_percent: finiteNumber.min(0).max(100).nullable().optional(),
    precipitation_mm: finiteNumber.nonnegative().nullable().optional(),
    pressure_msl_hpa: finiteNumber.nonnegative().nullable().optional(),
    pressure_surface_hpa: finiteNumber.nonnegative().nullable().optional(),
    temperature_celsius: nullableNumber,
    weather_description: nullableString,
    wind_direction_degrees: finiteNumber.min(0).max(360).nullable().optional(),
    wind_speed_kmh: finiteNumber.nonnegative().nullable().optional(),
  })
  .strict();

const dailyForecastSummarySchema = z
  .object({
    tomorrow_max_temp_c: nullableNumber,
    tomorrow_min_temp_c: nullableNumber,
    tomorrow_precipitation_mm: finiteNumber.nonnegative().nullable().optional(),
  })
  .strict();

const climateTrendsSchema = z
  .object({
    average_annual_rainfall_mm: finiteNumber.nonnegative().nullable().optional(),
    avg_surface_pressure_hpa: finiteNumber.nonnegative().nullable().optional(),
    rainfall_trend_mm: nullableNumber,
    temperature_change_rate_per_year: nullableNumber,
    temperature_trend_celsius: nullableNumber,
  })
  .strict();

const airQualityFactorsSchema = z
  .object({
    cloud_cover_percent: finiteNumber.min(0).max(100).nullable().optional(),
    humidity_percent: finiteNumber.min(0).max(100).nullable().optional(),
    pressure_msl_hpa: finiteNumber.nonnegative().nullable().optional(),
    wind_speed_m_s: finiteNumber.nonnegative().nullable().optional(),
  })
  .strict();

const airQualitySchema = z
  .object({
    category: nullableString,
    estimated: z.boolean().optional(),
    estimated_aqi: finiteNumber.min(0).max(500).nullable().optional(),
    factors: airQualityFactorsSchema.optional(),
    health_recommendation: nullableString,
    method: nullableString,
  })
  .strict();

const monthSchema = z.number().int().min(1).max(12);
const droughtRiskSchema = z
  .object({
    annual_precipitation_mm: finiteNumber.nonnegative().nullable().optional(),
    classification: nullableString,
    drought_risk: nullableString,
    dry_season_months: z.array(monthSchema).optional(),
    wet_season_months: z.array(monthSchema).optional(),
  })
  .strict();

const historicalSummarySchema = z
  .object({
    avg_max_temp_c: nullableNumber,
    avg_min_temp_c: nullableNumber,
    avg_surface_pressure_hpa: finiteNumber.nonnegative().nullable().optional(),
    max_wind_speed_kmh: finiteNumber.nonnegative().nullable().optional(),
    period_end: nullableString,
    period_start: nullableString,
    total_precipitation_mm: finiteNumber.nonnegative().nullable().optional(),
  })
  .strict();

export const environmentalCitySchema = z
  .object({
    air_quality: airQualitySchema,
    climate_trends: climateTrendsSchema,
    coordinates: z
      .object({
        latitude: finiteNumber.min(-90).max(90),
        longitude: finiteNumber.min(-180).max(180),
      })
      .strict(),
    current_conditions: currentConditionsSchema,
    daily_forecast_summary: dailyForecastSummarySchema,
    drought_risk: droughtRiskSchema,
    historical_summary: historicalSummarySchema,
    population: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const environmentalReportSchema = z
  .object({
    cities: z.record(z.string().min(1), environmentalCitySchema),
    country_level: z
      .object({
        climate_context: z
          .object({
            classification: z.string(),
            key_water_basins: z.array(z.string()),
            main_climate_challenges: z.array(z.string()),
          })
          .strict(),
        world_bank_climate_data: z
          .object({ status: z.string().optional() })
          .strict(),
      })
      .strict(),
    metadata: z
      .object({
        cities_analyzed: z.number().int().nonnegative(),
        country: z.string().min(1),
        data_sources: z.array(z.string().min(1)),
        report_date: z.string().min(1),
      })
      .strict(),
    summary: z
      .object({
        data_collection_date: z.string().min(1),
        key_findings: z.array(z.string()),
        recommendations: z.array(z.string()),
        total_cities_analyzed: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

/*
PORT STATUS
  source:     app/Http/Controllers/Api/PopulationAtlasController.php (216 lines)
  confidence: high
  todos:      0
  notes:      Native trust boundaries validate every atlas field before screen state receives it.
*/
