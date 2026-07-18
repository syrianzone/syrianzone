import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useF3aliaEvents, type F3aliaEventsState } from '@/components/F3aliaEvents';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import {
  loadRoznamaPrayerSchedule,
  loadRoznamaWeather,
} from './data';
import RoznamaIndex from './Index';

jest.mock('./data', () => ({
  loadRoznamaPrayerSchedule: jest.fn(),
  loadRoznamaWeather: jest.fn(),
}));

jest.mock('@/components/F3aliaEvents', () => ({
  ...jest.requireActual('@/components/F3aliaEvents'),
  useF3aliaEvents: jest.fn(),
}));

const eventState: F3aliaEventsState = {
  data: {
    cached: false,
    events: [
      {
        address: 'دار الأوبرا',
        attachments: null,
        category: { nameAr: 'ثقافة', nameEn: 'Culture' },
        description: 'أمسية ثقافية',
        endDate: null,
        endTime: null,
        eventDate: '2026-07-18',
        eventLink: 'https://app.f3alia.com/events/7',
        eventTime: '18:30',
        id: '7',
        isFree: true,
        isOnline: false,
        name: 'أمسية دمشقية',
        owner: { logoImage: null, organizerName: 'دار الثقافة' },
        province: 'DAMASCUS',
        provinceName: 'Damascus',
        ticketPrice: 0,
      },
    ],
    isShowingFallbackEvents: false,
    totalElements: 1,
  },
  error: false,
  loading: false,
  refreshing: false,
  retry: jest.fn(),
};

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
          <RoznamaIndex
            liveClock={false}
            now={() => new Date(2026, 6, 16, 20, 0, 0)}
          />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  jest.mocked(loadRoznamaWeather).mockResolvedValue({
    cached: false,
    value: { description: 'clear sky', icon: '01d', temperature: 29 },
  });
  jest.mocked(loadRoznamaPrayerSchedule).mockResolvedValue({
    cached: false,
    value: {
      hijriDate: '1 محرم 1448',
      timings: {
        Asr: '15:30',
        Dhuhr: '12:15',
        Fajr: '05:00',
        Isha: '19:30',
        Maghrib: '18:00',
        Sunrise: '06:30',
      },
    },
  });
  jest.mocked(useF3aliaEvents).mockReturnValue(eventState);
});

test('renders the clock, daily widgets, holidays, and event details in RTL', async () => {
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('29°C')).toBeTruthy());
  expect(view.getByTestId('roznama-screen')).toHaveStyle({ direction: 'rtl' });
  expect(view.getByText('20:00:00')).toBeTruthy();
  expect(view.getByText('1 محرم 1448')).toBeTruthy();
  expect(view.getByText('سماء صافية')).toBeTruthy();
  expect(view.getByText('صلاة الفجر')).toBeTruthy();
  expect(view.getByText('09:00:00')).toBeTruthy();
  expect(view.getAllByText('المولد النبوي الشريف')).toHaveLength(2);
  expect(view.getByText('أمسية دمشقية')).toBeTruthy();
  expect(view.getAllByText('الفعاليات القادمة في دمشق')).toHaveLength(1);
  expect(view.getByText('المصدر: المرسوم رقم 188 لعام 2025')).toBeTruthy();
});

test('persists filters and shows safe cached or failed widget states', async () => {
  jest.mocked(loadRoznamaWeather).mockResolvedValue({
    cached: true,
    value: { description: 'clear sky', icon: '01d', temperature: 29 },
  });
  jest.mocked(loadRoznamaPrayerSchedule).mockRejectedValue(
    new Error('private upstream response'),
  );
  const view = await renderScreen();

  await waitFor(() =>
    expect(view.getByText('يتم عرض آخر بيانات الطقس المحفوظة.')).toBeTruthy(),
  );
  expect(view.getByText('تعذر تحميل مواقيت الصلاة.')).toBeTruthy();
  expect(view.queryByText('private upstream response')).toBeNull();

  await fireEvent(
    view.getByTestId('roznama-hide-passed'),
    'valueChange',
    true,
  );
  await fireEvent.press(view.getByTestId('roznama-governorate-aleppo'));
  await fireEvent(
    view.getByTestId('roznama-show-all-events'),
    'valueChange',
    true,
  );

  await waitFor(() => {
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'sz-hide-passed-holidays',
      'true',
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'sz-roznama-governorate',
      'aleppo',
    );
  });
  expect(useF3aliaEvents).toHaveBeenLastCalledWith(
    expect.objectContaining({
      allProvinces: true,
      fallbackToAll: false,
      governorate: 'aleppo',
      size: 15,
    }),
  );
});
