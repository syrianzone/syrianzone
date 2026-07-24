import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { loadBundledProvinceData } from '@/lib/geojson/bundled';

import { fetchEnvironmentalReport, fetchPopulationMaster } from './lib/data-fetcher';
import PopulationClient from './PopulationClient';
import type {
  EnvironmentalReport,
  PopulationCollection,
  PopulationMasterData,
} from './types';

jest.mock('@/lib/geojson/bundled', () => ({
  loadBundledProvinceData: jest.fn(),
}));

jest.mock('./lib/data-fetcher', () => ({
  fetchEnvironmentalReport: jest.fn(),
  fetchPopulationMaster: jest.fn(),
}));

jest.mock('./components/map/MapClient', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<
    typeof import('react-native')
  >('react-native');

  return function MockPopulationMap({
    data,
    onSelect,
  }: {
    data: PopulationCollection;
    onSelect: (feature: PopulationCollection['features'][number]) => void;
  }) {
    return React.createElement(
      View,
      { testID: 'population-map' },
      ...data.features.map((feature) => {
        const name = String(feature.properties.province_name);
        return React.createElement(
          Pressable,
          {
            key: name,
            onPress: () => onSelect(feature),
            testID: `population-map-${name}`,
          },
          React.createElement(Text, null, name),
        );
      }),
    );
  };
});

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
        date: '2026-01-01',
        note: 'Displacement source',
        source_id: 3,
        source_url: null,
      },
    ],
    idp_returnees: [
      {
        cities: { Aleppo: 80, Damascus: 100 },
        date: '2026-01-01',
        note: 'Return source',
        source_id: 4,
        source_url: null,
      },
    ],
    population: [
      {
        cities: { Aleppo: 2_000, Damascus: 1_000 },
        date: '2025-01-01',
        note: 'Population source A',
        source_id: 1,
        source_url: 'https://example.com/a',
      },
      {
        cities: { Aleppo: 4_000, Damascus: 3_000 },
        date: '2026-01-01',
        note: 'Population source B',
        source_id: 2,
        source_url: 'https://example.com/b',
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

const environment = {
  cities: {
    Damascus: {
      air_quality: {
        category: 'Good',
        estimated: true,
        estimated_aqi: 40,
        factors: {},
        health_recommendation: 'Outdoor activities are safe.',
        method: 'Weather estimate',
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
    world_bank_climate_data: {},
  },
  metadata: {
    cities_analyzed: 1,
    country: 'Syria',
    data_sources: ['Open-Meteo'],
    report_date: '2026-01-14',
  },
  summary: {
    data_collection_date: '2026-01-14',
    key_findings: ['One city has current climate data'],
    recommendations: ['Conserve water'],
    total_cities_analyzed: 1,
  },
} satisfies EnvironmentalReport;

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, networkMode: 'always', retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AppThemeProvider>
          <PopulationClient />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loadBundledProvinceData).mockResolvedValue(boundaries);
  jest.mocked(fetchPopulationMaster).mockResolvedValue(master);
  jest.mocked(fetchEnvironmentalReport).mockResolvedValue(environment);
});

test('switches demographic sources and compares two governorates', async () => {
  const view = await renderScreen();

  await waitFor(() => expect(view.getByTestId('population-map')).toBeTruthy());
  expect(view.getAllByText('Population source A').length).toBeGreaterThan(0);
  await fireEvent.press(view.getByTestId('population-map-Damascus'));
  expect(view.getByTestId('population-province-summary')).toHaveTextContent(
    /دمشق/,
  );
  expect(view.getByTestId('population-province-summary')).toHaveTextContent(
    /1,000/,
  );
  await fireEvent.press(view.getByTestId('population-source-2'));
  expect(view.getAllByText('Population source B').length).toBeGreaterThan(0);

  await fireEvent.press(view.getByTestId('population-compare-0'));
  await fireEvent.press(view.getByTestId('population-compare-1'));

  expect(view.getByTestId('population-comparison')).toBeTruthy();
  expect(view.getByTestId('population-comparison-population')).toHaveTextContent(
    /3,000/,
  );
  expect(view.getByTestId('population-comparison-population')).toHaveTextContent(
    /4,000/,
  );
  expect(view.getByTestId('population-comparison-idp')).toHaveTextContent(/200/);
  expect(view.getByTestId('population-comparison-idp_returnees')).toHaveTextContent(
    /80/,
  );
});

test('shows annual rainfall and its historical average for a map selection', async () => {
  const view = await renderScreen();

  await waitFor(() => expect(view.getByTestId('population-map')).toBeTruthy());
  await fireEvent.press(view.getByTestId('population-tab-rainfall'));
  await fireEvent.press(view.getByTestId('population-map-Damascus'));

  const details = view.getByTestId('population-rainfall-details');
  expect(details).toHaveTextContent(/2024/);
  expect(details).toHaveTextContent(/120\.0 ملم/);
  expect(details).toHaveTextContent(/110\.0 ملم/);

  await fireEvent.press(view.getByTestId('population-map-Aleppo'));
  expect(view.getByText('لا توجد بيانات مطرية لهذه المحافظة.')).toBeTruthy();
});

test('renders national climate context and selected province measurements', async () => {
  const view = await renderScreen();

  await waitFor(() => expect(view.getByTestId('population-map')).toBeTruthy());
  await fireEvent.press(view.getByTestId('population-tab-environmental'));
  expect(view.getByText('البيانات البيئية لسوريا')).toBeTruthy();
  expect(view.getByText('One city has current climate data')).toBeTruthy();

  await fireEvent.press(view.getByTestId('population-map-Damascus'));
  const details = view.getByTestId('population-environment-details');
  expect(details).toHaveTextContent(/جودة الهواء/);
  expect(details).toHaveTextContent(/40/);
  expect(details).toHaveTextContent(/مخاطر الجفاف/);
  expect(details).toHaveTextContent(/Very High/);
  expect(details).toHaveTextContent(/اتجاهات المناخ/);
  expect(details).toHaveTextContent(/-109\.2 ملم/);
});
