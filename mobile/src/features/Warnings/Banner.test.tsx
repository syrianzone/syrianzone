import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { fetchWarnings } from './api';
import { LatestWarningBanner } from './Banner';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('./api', () => ({
  ...jest.requireActual<typeof import('./api')>('./api'),
  fetchWarnings: jest.fn(),
}));

const now = Date.parse('2026-09-03T12:00:00Z');

function payload(publishedAt: string) {
  return {
    fetched_at: '2026-09-03T12:00:00+00:00',
    items: [
      {
        description: '',
        id: '9',
        link: 'https://example.test/9.xml',
        published_at: publishedAt,
        source: { color: '#ef4444', name: 'Feed', slug: 'feed' },
        title: 'تحذير من عاصفة',
      },
    ],
    stale: false,
  };
}

function Providers({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
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
});

test('renders nothing when the newest warning is older than a day', async () => {
  jest.mocked(fetchWarnings).mockResolvedValue(payload('2026-09-02T11:00:00Z'));

  const view = await render(<LatestWarningBanner now={now} />, {
    wrapper: Providers,
  });

  await waitFor(() => expect(fetchWarnings).toHaveBeenCalledTimes(1));
  expect(view.queryByTestId('latest-warning-banner')).toBeNull();
});

test('renders nothing while loading or when there are no warnings', async () => {
  jest.mocked(fetchWarnings).mockResolvedValue({
    fetched_at: '2026-09-03T12:00:00+00:00',
    items: [],
    stale: false,
  });

  const view = await render(<LatestWarningBanner now={now} />, {
    wrapper: Providers,
  });

  expect(view.queryByTestId('latest-warning-banner')).toBeNull();
  await waitFor(() => expect(fetchWarnings).toHaveBeenCalledTimes(1));
  expect(view.queryByTestId('latest-warning-banner')).toBeNull();
});

test('shows a fresh warning and opens the warnings feature on press', async () => {
  jest.mocked(fetchWarnings).mockResolvedValue(payload('2026-09-03T09:30:00Z'));

  const view = await render(<LatestWarningBanner now={now} />, {
    wrapper: Providers,
  });

  await waitFor(() => expect(view.getByText('تحذير من عاصفة')).toBeTruthy());
  expect(view.getByText('تنبيه طوارئ')).toBeTruthy();

  fireEvent.press(view.getByTestId('latest-warning-banner'));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/feature/[slug]',
    params: { slug: 'warnings' },
  });
});
