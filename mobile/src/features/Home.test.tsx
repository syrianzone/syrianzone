import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ComponentType } from 'react';

import F3aliaEvents from '@/components/F3aliaEvents';
import { HomeSettingsProvider } from '@/contexts/HomeSettingsContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';
import { fetchPrayerTimes, fetchWeather } from '@/lib/home/widgets';

import Home from './Home';
import { fetchHomeContent } from './Home/api';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/lib/linking', () => ({
  openSafeExternalUrl: jest.fn(async () => true),
}));

jest.mock('@/lib/home/widgets', () => ({
  fetchPrayerTimes: jest.fn(),
  fetchWeather: jest.fn(),
}));

jest.mock('./Home/api', () => ({
  fetchHomeContent: jest.fn(),
}));

jest.mock('@/components/F3aliaEvents', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );
  return {
    __esModule: true,
    default: jest.fn(({ governorate }: { governorate: string }) =>
      React.createElement(
        Text,
        { testID: 'home-f3alia' },
        `F3alia ${governorate}`,
      ),
    ),
  };
});

const content = {
  about_content: '# About',
  quick_links: [
    {
      id: 'calendar',
      label_ar: 'الروزنامة',
      label_en: 'Calendar',
      target: 'roznama',
      type: 'feature' as const,
    },
    {
      id: 'joory',
      label_ar: 'جوري',
      label_en: 'Joory',
      target: 'https://joory.chat',
      type: 'external' as const,
    },
  ],
  search_providers: [
    {
      id: 'duckduckgo' as const,
      label: 'DuckDuckGo',
      template: 'https://duckduckgo.com/?q=%s',
    },
  ],
};

const TestableHome = Home as ComponentType<{
  liveClock?: boolean;
  now?: () => Date;
}>;

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
          <HomeSettingsProvider>
            <TestableHome
              liveClock={false}
              now={() => new Date(2026, 6, 16, 12, 0, 0)}
            />
          </HomeSettingsProvider>
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  jest.mocked(fetchHomeContent).mockResolvedValue(content);
  jest.mocked(fetchWeather).mockResolvedValue({
    description: 'clear sky',
    icon: '01d',
    temperature: 29,
  });
  jest.mocked(fetchPrayerTimes).mockResolvedValue({
    Asr: '15:30',
    Dhuhr: '12:15',
    Fajr: '05:00',
    Isha: '20:00',
    Maghrib: '18:45',
    Sunrise: '06:00',
  });
});

afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

test('renders custom local widgets, Hijri date, F3alia, and server quick links', async () => {
  await AsyncStorage.setItem(
    'startpage-settings',
    JSON.stringify({
      customCoordinates: { latitude: 33.7, longitude: 36.4 },
      governorate: 'aleppo',
      useCustomCoordinates: true,
    }),
  );
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('29°C')).toBeTruthy());
  expect(view.getByTestId('home-hijri-date').props.children).toContain('هـ');
  expect(view.getByTestId('home-f3alia')).toBeTruthy();
  expect(view.getByText('الروزنامة')).toBeTruthy();
  expect(view.getByText('جوري')).toBeTruthy();
  expect(fetchWeather).toHaveBeenCalledWith(33.7, 36.4, expect.anything());
  expect(fetchPrayerTimes).toHaveBeenCalledWith(
    33.7,
    36.4,
    expect.any(Date),
    expect.anything(),
  );
  expect(F3aliaEvents).toHaveBeenCalledWith(
    expect.objectContaining({ governorate: 'aleppo', variant: 'single' }),
    undefined,
  );

  await fireEvent.press(view.getByText('الروزنامة'));
  expect(router.push).toHaveBeenCalledWith({
    params: { slug: 'roznama' },
    pathname: '/feature/[slug]',
  });
  await fireEvent.press(view.getByText('جوري'));
  expect(openSafeExternalUrl).toHaveBeenCalledWith('https://joory.chat');
});

test('adds, opens, and removes a safe personal link', async () => {
  const view = await renderScreen();
  await waitFor(() => expect(view.getByText('الروزنامة')).toBeTruthy());
  expect(view.getByTestId('home-custom-link-name')).toBeTruthy();

  await fireEvent.changeText(view.getByTestId('home-custom-link-name'), 'My guide');
  await fireEvent.changeText(
    view.getByTestId('home-custom-link-url'),
    'https://guide.example/syria',
  );
  await fireEvent.press(view.getByTestId('home-add-custom-link'));

  await waitFor(() => expect(view.getByText('My guide')).toBeTruthy());
  await fireEvent.press(view.getByText('My guide'));
  expect(openSafeExternalUrl).toHaveBeenCalledWith(
    'https://guide.example/syria',
  );

  await fireEvent.press(view.getByTestId(/home-remove-custom-link-/));
  await waitFor(() => expect(view.queryByText('My guide')).toBeNull());
  const stored = await AsyncStorage.getItem('startpage-settings');
  expect(JSON.parse(stored ?? '{}').customLinks).toEqual([]);
});

test('keeps every source external link available when Home content is offline', async () => {
  jest.mocked(fetchHomeContent).mockRejectedValue(new Error('offline'));
  const view = await renderScreen();

  await waitFor(() =>
    expect(
      view.getByText(
        'تعذر تحديث الروابط. يتم عرض النسخة المحفوظة في التطبيق.',
      ),
    ).toBeTruthy(),
  );
  expect(view.getByText('إجابات سوريا')).toBeTruthy();
  expect(view.getByText('مجتمع كوديكس')).toBeTruthy();
  expect(view.getByText('مبدل العلم')).toBeTruthy();
  expect(view.getByText('الحسابات الرسمية')).toBeTruthy();
});

test('opens the central directory from the Home tools', async () => {
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('الروزنامة')).toBeTruthy());
  await waitFor(() => expect(view.getByText('29°C')).toBeTruthy());
  await waitFor(() => expect(view.getByText('الدليل المركزي')).toBeTruthy());
  await fireEvent.press(view.getByText('الدليل المركزي'));

  expect(router.push).toHaveBeenCalledWith('/central');
});
