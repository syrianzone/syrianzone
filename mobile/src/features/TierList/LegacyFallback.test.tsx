/**
 * The government tier list is the headline screen, and production syrian.zone
 * still answers 404 for every /api/mobile route, so it has to fill its board from
 * the website's own poll API. The fixture is a trimmed recording of the live
 * /api/polls/best-ministers response.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { AuthProvider } from '@/contexts/AuthContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import detailFixture from '@/lib/api/__fixtures__/legacy-poll-detail.json';
import { apiClient, type ApiRequestOptions } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { AuthService } from '@/lib/auth/service';

import TierListIndex from './Index';

const signedOut: AuthService = {
  bootstrap: jest.fn(async () => null),
  login: jest.fn(),
  logout: jest.fn(async () => undefined),
  refreshUser: jest.fn(async () => {
    throw new Error('No authenticated user');
  }),
};

function Providers({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, networkMode: 'always', retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AppThemeProvider>
          <AuthProvider queryClient={queryClient} service={signedOut}>
            {children}
          </AuthProvider>
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.spyOn(apiClient, 'request').mockImplementation(
    async <T,>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
      if (path.startsWith('/api/mobile')) {
        throw new ApiError(404, 'http_404', 'مسار غير موجود.');
      }
      if (path === '/api/polls/best-ministers') {
        return options.schema.parse(detailFixture);
      }
      throw new Error(`unexpected request to ${path}`);
    },
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('fills the government board from the website poll API', async () => {
  const view = await render(<TierListIndex />, { wrapper: Providers });

  await waitFor(() => expect(view.getByText('أسعد حسن الشيباني')).toBeTruthy());
  expect(view.getByText('خالد زعرور')).toBeTruthy();
  expect(view.queryByLabelText('جاري تحميل الاستطلاع')).toBeNull();
});
