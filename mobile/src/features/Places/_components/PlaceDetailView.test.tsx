import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { placeDetail } from '@/test/fixtures/places';

import { placesApi } from '../_lib/api';
import { PlaceDetailView } from './PlaceDetailView';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../_lib/api', () => ({
  placesApi: { getPlace: jest.fn() },
}));
jest.mock('./PhotoGallery', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { PhotoGallery: () => <Text>معرض المكان</Text> };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    clearError: jest.fn(),
    error: null,
    isAdmin: false,
    isSuperAdmin: false,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    user: null,
  });
  jest.mocked(placesApi.getPlace).mockResolvedValue(placeDetail);
});

test('shows the contributor named rank in place details', async () => {
  const view = await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } })}>
      <LocaleProvider>
        <AppThemeProvider>
          <PlaceDetailView onClose={jest.fn()} placeId={placeDetail.id} />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );

  await waitFor(() => expect(view.getByText(placeDetail.user.name)).toBeTruthy());
  expect(view.getByLabelText('مستكشف، المستوى 4')).toBeTruthy();
  expect(view.getByText('مستكشف')).toBeTruthy();
});
