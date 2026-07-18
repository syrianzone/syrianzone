import { fireEvent, render } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';

import {
  F3aliaEventsView,
  type F3aliaEventsState,
} from './F3aliaEvents';
import type { F3aliaEvent } from './F3aliaEvents.model';

jest.mock('@/lib/linking', () => ({
  ...jest.requireActual('@/lib/linking'),
  openSafeExternalUrl: jest.fn(async () => true),
}));

const event: F3aliaEvent = {
  address: 'دار الأوبرا',
  attachments: null,
  category: { nameAr: 'ثقافة', nameEn: 'Culture' },
  description: 'أمسية ثقافية مفتوحة للجميع',
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
};

function state(overrides: Partial<F3aliaEventsState> = {}): F3aliaEventsState {
  return {
    data: {
      cached: false,
      events: [event],
      isShowingFallbackEvents: false,
      totalElements: 1,
    },
    error: false,
    loading: false,
    refreshing: false,
    retry: jest.fn(),
    ...overrides,
  };
}

function renderView(
  props: Partial<React.ComponentProps<typeof F3aliaEventsView>> = {},
) {
  return render(
    <LocaleProvider>
      <AppThemeProvider>
        <F3aliaEventsView
          governorate="damascus"
          language="ar"
          state={state()}
          variant="grid"
          {...props}
        />
      </AppThemeProvider>
    </LocaleProvider>,
  );
}

test('renders the complete Arabic event detail and opens its safe source link', async () => {
  const view = await renderView();

  expect(view.getByTestId('f3alia-events')).toHaveStyle({ direction: 'rtl' });
  expect(view.getByText('الفعاليات القادمة في دمشق')).toBeTruthy();
  expect(view.getByText('أمسية دمشقية')).toBeTruthy();
  expect(view.getByText('أمسية ثقافية مفتوحة للجميع')).toBeTruthy();
  expect(view.getByText('دار الأوبرا')).toBeTruthy();
  expect(view.getByText('دار الثقافة')).toBeTruthy();
  expect(view.getByText('مجاني')).toBeTruthy();

  fireEvent.press(view.getByText('حجز / تفاصيل'));
  expect(openSafeExternalUrl).toHaveBeenCalledWith(event.eventLink);
});

test('labels persistent cache and cross-province fallback data', async () => {
  const cachedState = state({
    data: {
      cached: true,
      events: [event],
      isShowingFallbackEvents: true,
      totalElements: 1,
    },
  });
  const view = await renderView({ state: cachedState });

  expect(
    view.getByText('تعذر تحديث الفعاليات. يتم عرض آخر بيانات محفوظة.'),
  ).toBeTruthy();
  expect(
    view.getByText('لا توجد فعاليات قادمة مسجلة حالياً في دمشق'),
  ).toBeTruthy();
  expect(
    view.getByText('نعرض لك الفعاليات القادمة في باقي المحافظات السورية.'),
  ).toBeTruthy();
});

test('shows a retryable safe error without upstream details', async () => {
  const retry = jest.fn();
  const view = await renderView({
    state: state({ data: undefined, error: true, retry }),
  });

  expect(view.getByText('فشل تحميل الفعاليات حالياً')).toBeTruthy();
  expect(view.queryByText('private upstream body')).toBeNull();
  fireEvent.press(view.getByText('إعادة المحاولة'));
  expect(retry).toHaveBeenCalledTimes(1);
});

test('keeps the compact English event variant bilingual', async () => {
  const view = await renderView({ language: 'en', variant: 'single' });

  expect(view.getByTestId('f3alia-events')).toHaveStyle({ direction: 'ltr' });
  expect(view.getByText(/Next Event:/)).toBeTruthy();
  expect(view.getByText('Damascus')).toBeTruthy();
  expect(view.getByText('Details')).toBeTruthy();
});
