import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
} from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { preferenceKeys } from '@/lib/storage/preferences';

import UnblockSyriaNotification, {
  unblockSyriaContent,
} from './UnblockSyriaNotification';

const dismissalQueryKey = [
  'preference',
  preferenceKeys.dismissUnblockSyria,
] as const;

function renderNotification(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AppThemeProvider>
          <UnblockSyriaNotification />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

describe('Unblock Syria notification', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('keeps a dismissal hidden when the route subtree remounts', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          gcTime: Infinity,
          retry: false,
        },
      },
    });
    queryClient.setQueryData(dismissalQueryKey, null);

    const first = await renderNotification(queryClient);
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(first.getByText(unblockSyriaContent.title)).toBeTruthy();

    await fireEvent.press(first.getByText(unblockSyriaContent.dismissText));
    expect(
      await AsyncStorage.getItem(preferenceKeys.dismissUnblockSyria),
    ).toBe('true');
    await first.unmount();

    const second = await renderNotification(queryClient);
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(second.queryByText(unblockSyriaContent.title)).toBeNull();
  });

  test('restores the notification when dismissal persistence fails', async () => {
    jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('storage unavailable'));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          gcTime: Infinity,
          retry: false,
        },
      },
    });
    queryClient.setQueryData(dismissalQueryKey, null);

    const screen = await renderNotification(queryClient);
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    await fireEvent.press(screen.getByText(unblockSyriaContent.dismissText));
    await act(async () => {
      await Promise.resolve();
    });

    expect(queryClient.getQueryData(dismissalQueryKey)).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(screen.getByText(unblockSyriaContent.title)).toBeTruthy();
  });
});
