import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';

import { HomeSettingsProvider } from '@/contexts/HomeSettingsContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import SettingsScreen from './Settings';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  PermissionStatus: { GRANTED: 'granted' },
  getCurrentPositionAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

async function renderScreen() {
  // The notifications card reads its device-local settings through react-query.
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <AppThemeProvider>
          <HomeSettingsProvider>
            <SettingsScreen />
          </HomeSettingsProvider>
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    canAskAgain: true,
    expires: 'never',
    granted: true,
    status: Location.PermissionStatus.GRANTED,
  });
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: {
      accuracy: 8,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude: 33.5138,
      longitude: 36.2765,
      speed: null,
    },
    mocked: true,
    timestamp: 1,
  });
});

test('stores a device location only after foreground permission is granted', async () => {
  const view = await renderScreen();

  await waitFor(() =>
    expect(view.getByTestId('home-use-custom-coordinates')).toBeTruthy(),
  );
  await fireEvent(
    view.getByTestId('home-use-custom-coordinates'),
    'valueChange',
    true,
  );
  await waitFor(() =>
    expect(view.getByTestId('home-use-device-location')).toBeTruthy(),
  );
  await fireEvent.press(view.getByTestId('home-use-device-location'));

  await waitFor(() => {
    expect(view.getByTestId('home-custom-latitude').props.value).toBe(
      '33.5138',
    );
    expect(view.getByTestId('home-custom-longitude').props.value).toBe(
      '36.2765',
    );
  });

  const stored = await AsyncStorage.getItem('startpage-settings');
  expect(stored).not.toBeNull();
  expect(JSON.parse(stored ?? '{}')).toMatchObject({
    customCoordinates: { latitude: 33.5138, longitude: 36.2765 },
    useCustomCoordinates: true,
  });
});

test('saves a validated custom search template', async () => {
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('مخصص')).toBeTruthy());
  await fireEvent.press(view.getByText('مخصص'));
  await waitFor(() =>
    expect(view.getByTestId('home-custom-search-url')).toBeTruthy(),
  );
  await fireEvent.changeText(
    view.getByTestId('home-custom-search-url'),
    'https://search.example/?q=%s',
  );
  await waitFor(() =>
    expect(view.getByTestId('home-custom-search-url').props.value).toBe(
      'https://search.example/?q=%s',
    ),
  );
  await fireEvent.press(view.getByTestId('home-save-custom-search'));

  await waitFor(async () => {
    const stored = await AsyncStorage.getItem('startpage-settings');
    expect(JSON.parse(stored ?? '{}')).toMatchObject({
      customSearchUrl: 'https://search.example/?q=%s',
      searchEngine: 'custom',
    });
  });
});
