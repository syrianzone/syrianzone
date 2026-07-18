import {
  environmentalReportSchema,
  populationMasterSchema,
} from './schemas';

const masterPayload = {
  groups: {
    population: [
      {
        cities: { Damascus: 2_103_000 },
        date: '2026-01-14',
        note: 'Population estimate',
        source_id: 1,
        source_url: 'https://example.com/population',
      },
    ],
  },
  rainfall_data: {
    SY01: [{ rainfall: 139.13, rainfall_avg: 115.18, year: 2024 }],
  },
};

const environmentPayload = {
  cities: {
    Damascus: {
      air_quality: {
        category: 'Good',
        estimated: true,
        estimated_aqi: 40,
        factors: {
          cloud_cover_percent: 1,
          humidity_percent: 54,
          pressure_msl_hpa: 1017.2,
          wind_speed_m_s: 29.1,
        },
        health_recommendation: 'Outdoor activities are safe.',
        method: 'Weather-based estimation',
      },
      climate_trends: {
        average_annual_rainfall_mm: 115.18,
        avg_surface_pressure_hpa: 933.9,
        rainfall_trend_mm: -109.2,
        temperature_change_rate_per_year: -2.215,
        temperature_trend_celsius: -11.07,
      },
      coordinates: { latitude: 33.51, longitude: 36.29 },
      current_conditions: {
        cloud_cover_percent: 1,
        feels_like_celsius: 2.7,
        humidity_percent: 54,
        precipitation_mm: 0,
        pressure_msl_hpa: 1017.2,
        pressure_surface_hpa: 934.8,
        temperature_celsius: 9,
        weather_description: 'Clear sky',
        wind_direction_degrees: 285,
        wind_speed_kmh: 29.1,
      },
      daily_forecast_summary: {
        tomorrow_max_temp_c: 9.6,
        tomorrow_min_temp_c: 0.5,
        tomorrow_precipitation_mm: 0,
      },
      drought_risk: {
        annual_precipitation_mm: 139.13,
        classification: 'Arid/Semi-arid',
        drought_risk: 'Very High',
        dry_season_months: [6, 7, 8],
        wet_season_months: [1, 2],
      },
      historical_summary: {
        avg_max_temp_c: 26.73,
        avg_min_temp_c: 13.31,
        avg_surface_pressure_hpa: 933.92,
        max_wind_speed_kmh: 42.5,
        period_end: '2026-01-14',
        period_start: '2021-01-15',
        total_precipitation_mm: 691.1,
      },
      population: 2_103_000,
    },
  },
  country_level: {
    climate_context: {
      classification: 'Mostly semi-arid to arid',
      key_water_basins: ['Euphrates River Basin'],
      main_climate_challenges: ['Water scarcity'],
    },
    world_bank_climate_data: {
      status: 'Data available via SyriaClimateService',
    },
  },
  metadata: {
    cities_analyzed: 1,
    country: 'Syria',
    data_sources: ['Open-Meteo'],
    report_date: '2026-01-14T16:12:28+00:00',
  },
  summary: {
    data_collection_date: '2026-01-14T16:14:04+00:00',
    key_findings: ['1/1 cities analyzed'],
    recommendations: ['Conserve water'],
    total_cities_analyzed: 1,
  },
};

test('normalizes missing population groups to empty arrays', () => {
  const parsed = populationMasterSchema.parse(masterPayload);

  expect(parsed.groups.population).toHaveLength(1);
  expect(parsed.groups.idp).toEqual([]);
  expect(parsed.groups.idp_returnees).toEqual([]);
  expect(parsed.groups.rainfall).toEqual([]);
  expect(parsed.groups.environmental).toEqual([]);
});

test('accepts the complete climate, air quality, drought, and rainfall contract', () => {
  const parsed = environmentalReportSchema.parse(environmentPayload);

  expect(parsed.cities.Damascus?.air_quality?.estimated_aqi).toBe(40);
  expect(parsed.cities.Damascus?.drought_risk?.dry_season_months).toEqual([
    6, 7, 8,
  ]);
  expect(parsed.cities.Damascus?.climate_trends?.rainfall_trend_mm).toBe(
    -109.2,
  );
});

test('rejects malformed population values and coordinates', () => {
  expect(
    populationMasterSchema.safeParse({
      ...masterPayload,
      groups: {
        population: [
          { ...masterPayload.groups.population[0], cities: { Damascus: 'many' } },
        ],
      },
    }).success,
  ).toBe(false);
  expect(
    environmentalReportSchema.safeParse({
      ...environmentPayload,
      cities: {
        Damascus: {
          ...environmentPayload.cities.Damascus,
          coordinates: { latitude: 133.51, longitude: 36.29 },
        },
      },
    }).success,
  ).toBe(false);
});
