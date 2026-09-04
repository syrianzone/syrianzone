import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { fetchPolls } from '@/lib/api/polls';

import PollsIndex from './Index';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn(), replace: jest.fn() },
}));

jest.mock('@/lib/api/polls', () => ({
  ...jest.requireActual('@/lib/api/polls'),
  fetchPolls: jest.fn(),
}));

function Providers({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, networkMode: 'always', retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AppThemeProvider>{children}</AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchPolls).mockResolvedValue([
    {
      id: 'poll-1',
      isActive: true,
      slug: 'best-ministers',
      timezone: 'Asia/Damascus',
      title: 'أفضل الوزراء',
    },
  ]);
});

test('opens a poll on its own route instead of swapping the screen in place', async () => {
  const view = await render(<PollsIndex />, { wrapper: Providers });

  await waitFor(() => expect(view.getByText('أفضل الوزراء')).toBeTruthy());
  await fireEvent.press(view.getByText('أفضل الوزراء'));

  expect(router.push).toHaveBeenCalledWith({
    params: { slug: 'best-ministers' },
    pathname: '/polls/[slug]',
  });
});
