import type { PopulationCollection, PopulationMasterData } from './types';
import {
  buildAtlasCollection,
  buildGovernorateComparison,
  comparisonGovernorates,
  rainfallYearForMap,
} from './model';
import { environmentalReportSchema } from './lib/schemas';
import { findRainData } from './utils/data-finder';

const boundaries = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[36, 33], [37, 33], [37, 34], [36, 33]]],
      },
      properties: { province_name: 'Damascus' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[36, 34], [37, 34], [37, 35], [36, 34]]],
      },
      properties: { province_name: 'Aleppo' },
    },
  ],
} as PopulationCollection;

const master = {
  groups: {
    environmental: [],
    idp: [
      {
        cities: { Aleppo: 350, Damascus: 200 },
        date: null,
        note: null,
        source_id: 2,
        source_url: null,
      },
    ],
    idp_returnees: [
      {
        cities: { Aleppo: 80, Damascus: 100 },
        date: null,
        note: null,
        source_id: 3,
        source_url: null,
      },
    ],
    population: [
      {
        cities: { Aleppo: 2_000, Damascus: 1_000 },
        date: null,
        note: null,
        source_id: 1,
        source_url: null,
      },
    ],
    rainfall: [],
  },
  rainfall_data: {
    SY01: [
      { rainfall: 90, rainfall_avg: 100, year: 2025 },
      { rainfall: 120, rainfall_avg: 110, year: 2024 },
    ],
  },
} satisfies PopulationMasterData;

const environment = environmentalReportSchema.parse({
  cities: {
    Damascus: {
      air_quality: {},
      climate_trends: {},
      coordinates: { latitude: 33.51, longitude: 36.29 },
      current_conditions: { temperature_celsius: 9 },
      daily_forecast_summary: {},
      drought_risk: {},
      historical_summary: {},
      population: 1_000,
    },
  },
  country_level: {
    climate_context: {
      classification: 'Arid',
      key_water_basins: [],
      main_climate_challenges: [],
    },
    world_bank_climate_data: {},
  },
  metadata: {
    cities_analyzed: 1,
    country: 'Syria',
    data_sources: [],
    report_date: '2026-01-01',
  },
  summary: {
    data_collection_date: '2026-01-01',
    key_findings: [],
    recommendations: [],
    total_cities_analyzed: 1,
  },
});

test('uses 2024 rainfall for the map and the latest year as fallback', () => {
  expect(rainfallYearForMap(master.rainfall_data.SY01 ?? [])?.rainfall).toBe(
    120,
  );
  expect(
    rainfallYearForMap([
      { rainfall: 12, rainfall_avg: 10, year: 2022 },
      { rainfall: 15, rainfall_avg: 11, year: 2025 },
    ])?.year,
  ).toBe(2025);
});

test('matches rainfall records for every bundled boundary name', () => {
  const names = [
    'Homs',
    'Rif Dimashq',
    'As Suwayda',
    'Quneitra',
    'Dar`a',
    'Aleppo',
    'Hamah',
    'Idlib',
    'Damascus',
    'Tartus',
    'Lattakia',
    'Al Ḥasakah',
    'Dayr Az Zawr',
    'Ar Raqqah',
  ];
  const rainfall = Object.fromEntries(
    Array.from({ length: 14 }, (_, index) => [
      `SY${String(index + 1).padStart(2, '0')}`,
      [{ rainfall: 100, rainfall_avg: 90, year: 2024 }],
    ]),
  );

  for (const name of names) {
    const feature = {
      ...boundaries.features[0]!,
      properties: { province_name: name },
    };
    expect(findRainData(feature, rainfall)).not.toBeNull();
  }
});

test('maps population, rainfall, and temperature values into province colors', () => {
  const population = buildAtlasCollection({
    boundaries,
    dataType: 'population',
    environment,
    master,
    source: master.groups.population[0] ?? null,
  });
  const rainfall = buildAtlasCollection({
    boundaries,
    dataType: 'rainfall',
    environment,
    master,
    source: null,
  });
  const climate = buildAtlasCollection({
    boundaries,
    dataType: 'environmental',
    environment,
    master,
    source: null,
  });

  expect(population.features[0]?.properties.atlasValue).toBe(1_000);
  expect(rainfall.features[0]?.properties.atlasValue).toBe(120);
  expect(climate.features[0]?.properties.atlasValue).toBe(9);
  expect(climate.features[1]?.properties.atlasValue).toBeNull();
  expect(climate.features[0]?.properties.atlasColor).not.toBe(
    climate.features[1]?.properties.atlasColor,
  );
});

test('keeps two governorates selected and builds all demographic comparisons', () => {
  expect(comparisonGovernorates(['دمشق', 'حلب'], 'حمص')).toEqual([
    'حلب',
    'حمص',
  ]);
  expect(comparisonGovernorates(['دمشق', 'حلب'], 'دمشق')).toEqual(['حلب']);

  const comparison = buildGovernorateComparison(master.groups, [
    'دمشق',
    'حلب',
  ]);
  expect(comparison?.first.name).toBe('دمشق');
  expect(comparison?.second.name).toBe('حلب');
  expect(comparison?.rows.map((row) => [row.type, row.first, row.second])).toEqual([
    ['population', 1_000, 2_000],
    ['idp', 200, 350],
    ['idp_returnees', 100, 80],
  ]);
});
