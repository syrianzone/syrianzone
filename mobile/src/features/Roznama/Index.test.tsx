import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

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

const emptyEventState: F3aliaEventsState = {
  ...eventState,
  data: {
    cached: false,
    events: [],
    isShowingFallbackEvents: false,
    totalElements: 0,
  },
};

type RenderedView = Awaited<ReturnType<typeof renderScreen>>;

// toJSON keeps document order, which is what the section-order assertion needs;
// the query helpers only report whether a node exists.
function orderedText(view: RenderedView): string[] {
  const lines: string[] = [];
  const gather = (node: unknown, parts: string[]) => {
    if (typeof node === 'string' || typeof node === 'number') {
      parts.push(String(node));
      return;
    }
    if (node && typeof node === 'object') {
      const children = (node as { children?: unknown[] }).children;
      children?.forEach((child) => gather(child, parts));
    }
  };
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    const element = node as { children?: unknown[]; type?: string };
    if (element.type === 'Text') {
      const parts: string[] = [];
      gather(element, parts);
      lines.push(parts.join(''));
      return;
    }
    element.children?.forEach(visit);
  };
  visit(view.toJSON());
  return lines;
}

function background(view: RenderedView, testID: string): unknown {
  return StyleSheet.flatten(view.getByTestId(testID).props.style)
    ?.backgroundColor;
}

async function renderScreen(now = new Date(2026, 6, 16, 20, 0, 0)) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, networkMode: 'always', retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AppThemeProvider>
          <RoznamaIndex liveClock={false} now={() => now} />
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

test('lays the sections out in the same order as the web page', async () => {
  const view = await renderScreen();
  await waitFor(() => expect(view.getByText('29°C')).toBeTruthy());

  const lines = orderedText(view);
  const positions = [
    'الروزنامة',
    'المحافظة:',
    '20:00:00',
    'المناسبة القادمة',
    'مواقيت الصلاة في دمشق',
    'العطل الرسمية في سوريا (2026م)',
    'الفعاليات القادمة في دمشق',
    'ملاحظات حول تعديلات العطل الرسمية (المرسوم 188 لعام 2025):',
  ].map((heading) => lines.findIndex((line) => line === heading));

  expect(positions).not.toContain(-1);
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
});

test('inverts the now badge so it stays visible on the active prayer row', async () => {
  const view = await renderScreen();
  await waitFor(() => expect(view.getByText('29°C')).toBeTruthy());

  const label = view.getByText('الآن');
  const badge = StyleSheet.flatten(label.parent?.props.style);
  const activeRow = background(view, 'roznama-prayer-Isha');
  expect(badge?.backgroundColor).toBeTruthy();
  expect(badge?.backgroundColor).not.toBe(activeRow);
  expect(StyleSheet.flatten(label.props.style)?.color).toBe(activeRow);
});

test('keeps the Arabic copy right aligned when the app locale is English', async () => {
  await AsyncStorage.setItem('sz-locale', 'en');
  const view = await renderScreen();
  await waitFor(() => expect(view.getByText('29°C')).toBeTruthy());

  expect(view.getByText('المناسبة القادمة')).toHaveStyle({ textAlign: 'right' });
  expect(view.getByText('مواقيت الصلاة في دمشق')).toHaveStyle({
    textAlign: 'right',
  });
});

test('falls back to the local Hijri calendar when the endpoint omits it', async () => {
  jest.mocked(loadRoznamaPrayerSchedule).mockResolvedValue({
    cached: false,
    value: { hijriDate: '', timings: { Fajr: '05:00', Isha: '19:30' } },
  });
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('29°C')).toBeTruthy());
  expect(view.queryByText('1 محرم 1448')).toBeNull();
  expect(view.getByText(/هـ$/)).toBeTruthy();
});

test('names the province on the next event line like the web page does', async () => {
  const view = await renderScreen();
  await waitFor(() => expect(view.getByText('29°C')).toBeTruthy());

  const line = orderedText(view).find((text) => text.startsWith('دمشق  •  '));
  expect(line).toContain('  •  18:30');
});

test('always credits F3alia, and offers the other provinces when empty', async () => {
  jest.mocked(useF3aliaEvents).mockReturnValue(emptyEventState);
  const view = await renderScreen();
  await waitFor(() => expect(view.getByText('29°C')).toBeTruthy());

  expect(
    view.getByText('المصدر: منصة فعالية (F3alia) للأحداث والفعاليات'),
  ).toBeTruthy();
  expect(view.getByText('عرض المزيد في المصدر')).toBeTruthy();

  await fireEvent.press(view.getByTestId('roznama-browse-all-events'));
  await waitFor(() =>
    expect(view.getByText('الفعاليات القادمة في باقي المحافظات')).toBeTruthy(),
  );
  expect(useF3aliaEvents).toHaveBeenLastCalledWith(
    expect.objectContaining({ allProvinces: true }),
  );
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
