import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';

import { fetchWarnings, JARD_WARNINGS_URL } from './api';
import WarningsScreen, { pillColors } from './Index';

jest.mock('@/lib/linking', () => ({
  openSafeExternalUrl: jest.fn(async () => true),
}));

jest.mock('./api', () => ({
  ...jest.requireActual<typeof import('./api')>('./api'),
  fetchWarnings: jest.fn(),
}));

const items = [
  {
    description: 'ارتفاع منسوب النهر',
    id: '2',
    link: 'https://example.test/2.xml',
    published_at: '2026-09-02T17:56:00+00:00',
    source: { color: '#ef4444', name: 'وزارة الطوارئ', slug: 'climweb_warnings' },
    title: 'تحذير من الفيضان',
  },
  {
    description: '',
    id: '1',
    link: 'https://example.test/1.xml',
    published_at: '2026-09-01T10:00:00+00:00',
    source: { color: '#ef4444', name: 'وزارة الطوارئ', slug: 'climweb_warnings' },
    title: 'موجة حر',
  },
];

// One client per test, created outside the wrapper: a client built inside the
// wrapper is replaced on every re-render, which restarts the query forever.
let client: QueryClient;

function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <AppThemeProvider>{children}</AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-02T20:00:00Z'));
});

afterEach(() => {
  client.clear();
  jest.restoreAllMocks();
});

test('renders warnings newest first with source, time, and open action', async () => {
  jest.mocked(fetchWarnings).mockResolvedValue({
    fetched_at: '2026-09-02T20:00:00+00:00',
    items,
    stale: false,
  });

  const view = await render(<WarningsScreen />, { wrapper: Providers });

  await waitFor(() => expect(view.getByText('تحذير من الفيضان')).toBeTruthy());
  expect(view.getByText('تنبيهات الطوارئ')).toBeTruthy();
  expect(view.getByText('وزارة الطوارئ وإدارة الكوارث عبر جرد')).toBeTruthy();
  expect(view.getByText('قبل ساعتين')).toBeTruthy();
  expect(view.getByText('ارتفاع منسوب النهر')).toBeTruthy();
  expect(view.getAllByText('وزارة الطوارئ')).toHaveLength(2);
  expect(view.queryByTestId('warnings-stale-notice')).toBeNull();

  const cards = view.getAllByTestId(/^warning-\d+$/);
  expect(cards.map((card) => card.props.testID)).toEqual(['warning-2', 'warning-1']);

  await fireEvent.press(view.getAllByText('فتح التنبيه')[0]!);
  expect(openSafeExternalUrl).toHaveBeenCalledWith('https://example.test/2.xml');

  await fireEvent.press(view.getByText('عرض كل التنبيهات على جرد'));
  expect(openSafeExternalUrl).toHaveBeenCalledWith(JARD_WARNINGS_URL);
});

test('shows the stale notice when the API says so', async () => {
  jest.mocked(fetchWarnings).mockResolvedValue({
    fetched_at: '2026-09-02T20:00:00+00:00',
    items,
    stale: true,
  });

  const view = await render(<WarningsScreen />, { wrapper: Providers });

  await waitFor(() => expect(view.getByTestId('warnings-stale-notice')).toBeTruthy());
  expect(view.getByText('تعذر تحديث التنبيهات. يتم عرض آخر نسخة محفوظة.')).toBeTruthy();
});

test('offers a retry when loading fails', async () => {
  jest.mocked(fetchWarnings).mockRejectedValue(new Error('offline'));

  const view = await render(<WarningsScreen />, { wrapper: Providers });

  await waitFor(() => expect(view.getByText('إعادة المحاولة')).toBeTruthy());
  expect(
    view.getByText('تعذر تحميل التنبيهات. تحقق من اتصالك وحاول مرة أخرى.'),
  ).toBeTruthy();
});

test('shows an empty state when the source has no warnings', async () => {
  jest.mocked(fetchWarnings).mockResolvedValue({
    fetched_at: '2026-09-02T20:00:00+00:00',
    items: [],
    stale: false,
  });

  const view = await render(<WarningsScreen />, { wrapper: Providers });

  await waitFor(() => expect(view.getByText('لا توجد تنبيهات حالياً.')).toBeTruthy());
});

test('tints the pill with the feed color and falls back on bad values', () => {
  expect(pillColors('#ef4444', '#000000')).toEqual({
    background: '#ef444422',
    foreground: '#ef4444',
  });
  expect(pillColors('red', '#000000')).toEqual({
    background: '#00000022',
    foreground: '#000000',
  });
});
