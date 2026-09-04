import { z } from 'zod';

const finiteNumber = z.number().finite();
const nullableNumber = finiteNumber.nullish();
const nullableString = z.string().nullish();

/**
 * The atlas API is a Laravel controller that hands PHP arrays to json_encode, so
 * a report block with no rows serializes as `[]` instead of `{}` and an unused
 * column is dropped from the response entirely. Normalizing both shapes here is
 * what keeps one thin block from failing the parse and blanking the whole map.
 */
function reportBlock<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess(
    (value) =>
      value === undefined || (Array.isArray(value) && value.length === 0)
        ? {}
        : value,
    schema,
  );
}

export const cityDataSchema = z.record(
  z.string().min(1),
  finiteNumber.nonnegative(),
);

// `date`, `note`, and `source_url` are absent on the `environmental` group that
// production synthesizes from the environmental logs, so they cannot be required.
export const dataSourceSchema = z.looseObject({
  cities: cityDataSchema,
  data_type: z
    .enum(['population', 'idp', 'idp_returnees', 'rainfall', 'environmental'])
    .optional(),
  date: nullableString,
  note: nullableString,
  source_id: z.number().int().nonnegative(),
  source_url: nullableString,
});

export const rainfallYearSchema = z.looseObject({
  rainfall: finiteNumber.nonnegative(),
  rainfall_avg: finiteNumber.nonnegative(),
  year: z.number().int(),
});

export const rainfallDataSchema = z.record(
  z.string().min(1),
  z.array(rainfallYearSchema),
);

const populationGroupsSchema = z.looseObject({
  environmental: z.array(dataSourceSchema).default([]),
  idp: z.array(dataSourceSchema).default([]),
  idp_returnees: z.array(dataSourceSchema).default([]),
  population: z.array(dataSourceSchema).default([]),
  rainfall: z.array(dataSourceSchema).default([]),
});

export const populationMasterSchema = z.looseObject({
  groups: populationGroupsSchema,
  rainfall_data: rainfallDataSchema.default({}),
});

const currentConditionsSchema = z.looseObject({
  cloud_cover_percent: nullableNumber,
  feels_like_celsius: nullableNumber,
  humidity_percent: nullableNumber,
  precipitation_mm: nullableNumber,
  pressure_msl_hpa: nullableNumber,
  pressure_surface_hpa: nullableNumber,
  temperature_celsius: nullableNumber,
  weather_description: nullableString,
  wind_direction_degrees: nullableNumber,
  wind_speed_kmh: nullableNumber,
});

const dailyForecastSummarySchema = z.looseObject({
  tomorrow_max_temp_c: nullableNumber,
  tomorrow_min_temp_c: nullableNumber,
  tomorrow_precipitation_mm: nullableNumber,
});

const climateTrendsSchema = z.looseObject({
  average_annual_rainfall_mm: nullableNumber,
  avg_surface_pressure_hpa: nullableNumber,
  rainfall_trend_mm: nullableNumber,
  temperature_change_rate_per_year: nullableNumber,
  temperature_trend_celsius: nullableNumber,
});

const airQualityFactorsSchema = z.looseObject({
  cloud_cover_percent: nullableNumber,
  humidity_percent: nullableNumber,
  pressure_msl_hpa: nullableNumber,
  wind_speed_m_s: nullableNumber,
});

const airQualitySchema = z.looseObject({
  category: nullableString,
  estimated: z.boolean().optional(),
  estimated_aqi: nullableNumber,
  factors: reportBlock(airQualityFactorsSchema),
  health_recommendation: nullableString,
  method: nullableString,
});

const monthSchema = z.number().int().min(1).max(12);
const droughtRiskSchema = z.looseObject({
  annual_precipitation_mm: nullableNumber,
  classification: nullableString,
  drought_risk: nullableString,
  dry_season_months: z.array(monthSchema).default([]),
  wet_season_months: z.array(monthSchema).default([]),
});

const historicalSummarySchema = z.looseObject({
  avg_max_temp_c: nullableNumber,
  avg_min_temp_c: nullableNumber,
  avg_surface_pressure_hpa: nullableNumber,
  max_wind_speed_kmh: nullableNumber,
  period_end: nullableString,
  period_start: nullableString,
  total_precipitation_mm: nullableNumber,
});

export const environmentalCitySchema = z.looseObject({
  air_quality: reportBlock(airQualitySchema),
  climate_trends: reportBlock(climateTrendsSchema),
  coordinates: reportBlock(
    z.looseObject({
      latitude: finiteNumber.min(-90).max(90).nullish(),
      longitude: finiteNumber.min(-180).max(180).nullish(),
    }),
  ),
  current_conditions: reportBlock(currentConditionsSchema),
  daily_forecast_summary: reportBlock(dailyForecastSummarySchema),
  drought_risk: reportBlock(droughtRiskSchema),
  historical_summary: reportBlock(historicalSummarySchema),
  population: z.number().int().nonnegative().nullish(),
});

export const environmentalReportSchema = z.looseObject({
  cities: z.record(z.string().min(1), environmentalCitySchema).default({}),
  country_level: reportBlock(
    z.looseObject({
      climate_context: reportBlock(
        z.looseObject({
          classification: z.string().default(''),
          key_water_basins: z.array(z.string()).default([]),
          main_climate_challenges: z.array(z.string()).default([]),
        }),
      ),
      world_bank_climate_data: reportBlock(
        z.looseObject({ status: z.string().optional() }),
      ),
    }),
  ),
  metadata: reportBlock(
    z.looseObject({
      cities_analyzed: nullableNumber,
      country: z.string().default(''),
      data_sources: z.array(z.string()).default([]),
      report_date: z.string().default(''),
    }),
  ),
  summary: reportBlock(
    z.looseObject({
      data_collection_date: z.string().default(''),
      key_findings: z.array(z.string()).default([]),
      recommendations: z.array(z.string()).default([]),
      total_cities_analyzed: nullableNumber,
    }),
  ),
});

/*
PORT STATUS
  source:     app/Http/Controllers/Api/PopulationAtlasController.php (216 lines)
  confidence: high
  todos:      0
  notes:      Schemas validate every atlas field the screens read while staying open to
              the extra and omitted keys the live controller actually emits.
*/
