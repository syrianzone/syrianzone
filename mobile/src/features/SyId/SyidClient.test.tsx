import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { loadBundledProvinceData } from '@/lib/geojson/bundled';
import { openSafeExternalUrl } from '@/lib/linking';

import { SYID_MATERIALS_ZIP_URL, shareSyidAsset } from './files';
import SyidClient from './SyidClient';
import type { PopulationCollection } from '../Population/types';

jest.mock('@/lib/geojson/bundled', () => ({
  loadBundledProvinceData: jest.fn(),
}));

jest.mock('@/lib/linking', () => ({
  openSafeExternalUrl: jest.fn(async () => true),
}));

jest.mock('./files', () => ({
  ...jest.requireActual<typeof import('./files')>('./files'),
  shareGeneratedFile: jest.fn(async () => true),
  shareSyidAsset: jest.fn(async () => true),
}));

jest.mock('./SyriaMap', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );

  return function MockSyriaMap() {
    return React.createElement(View, { testID: 'syid-map' });
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
      properties: { id: 'SY01', province_name: 'Damascus' },
    },
  ],
} as PopulationCollection;

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
          <SyidClient />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(loadBundledProvinceData).mockResolvedValue(boundaries);
});

test('the flag proportions card loads the published image and download targets', async () => {
  const view = await renderScreen();

  // expo-image normalizes `source` into an array of resolved sources.
  expect(
    view.getByLabelText('العلم السوري بالنسب الصحيحة').props.source,
  ).toEqual([
    {
      uri: 'https://syrian.zone/syid-assets/materials/syrian-flag-proportions.png',
    },
  ]);

  await fireEvent.press(view.getByTestId('syid-flag-png'));
  await fireEvent.press(view.getByTestId('syid-flag-svg'));
  await fireEvent.press(view.getByTestId('syid-flag-dwg'));

  expect(
    jest.mocked(shareSyidAsset).mock.calls.map(([relativePath]) => relativePath),
  ).toEqual([
    'syrian-flag-proportions.png',
    'syrian-flag-proportions.svg',
    'syrian-flag.dwg',
  ]);
  // Each press re-renders the whole identity screen, so the default 5s budget is
  // too tight under `jest --runInBand --coverage`.
}, 20_000);

test('the flag proportions card carries the diagram measurements', async () => {
  const view = await renderScreen();

  const measurements = view.getByTestId('syid-flag-measurements');
  expect(measurements).toHaveTextContent(/العرض الكلي/);
  expect(measurements).toHaveTextContent(/36/);
  expect(measurements).toHaveTextContent(/24/);
  expect(measurements).toHaveTextContent(/9 \+ 9 \+ 9 \+ 9/);
  expect(measurements).toHaveTextContent(/8 \+ 8 \+ 8/);
  expect(measurements).toHaveTextContent(/6 \+ 6 \+ 3 \+ 6 \+ 3 \+ 6 \+ 6/);
});

test('the identity bundle button opens the R2 download the website links', async () => {
  const view = await renderScreen();

  await fireEvent.press(view.getByText('تحميل المواد والموارد الرسمية'));

  expect(jest.mocked(openSafeExternalUrl)).toHaveBeenCalledWith(
    SYID_MATERIALS_ZIP_URL,
  );
});
