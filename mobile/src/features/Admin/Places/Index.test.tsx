import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import { AppThemeProvider } from '@/contexts/ThemeContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { useAuth } from '@/contexts/AuthContext';
import { placesApi } from '@/features/Places/_lib/api';
import type { AdminPlace } from '@/features/Places/_lib/types';
import { adminPlace } from '@/test/fixtures/places';

import AdminPlacesScreen from './Index';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('@/features/Places/_lib/api', () => ({
  placesApi: {
    adminApprove: jest.fn(),
    adminDeletePlace: jest.fn(),
    adminListPlaces: jest.fn(),
    adminReject: jest.fn(),
  },
}));

jest.mock('./PlaceReviewCard', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PlaceReviewCard: ({
      onApprove,
      onDelete,
      onReject,
      place,
    }: {
      onApprove: () => Promise<void>;
      onDelete: () => void;
      onReject: (reason: string | null) => Promise<void>;
      place: AdminPlace;
    }) => React.createElement(
      View,
      null,
      React.createElement(Text, null, place.name),
      React.createElement(Pressable, { onPress: onApprove, testID: `approve-${place.id}` }),
      React.createElement(Pressable, { onPress: () => onReject('بيانات ناقصة'), testID: `reject-${place.id}` }),
      React.createElement(Pressable, { onPress: onDelete, testID: `delete-${place.id}` }),
    ),
  };
});

const adminUser = {
  avatar_url: null,
  email: 'admin@example.com',
  id: 1,
  is_banned: false,
  name: 'Admin',
  role: 'admin',
};

function authValue(user: typeof adminUser | null = adminUser) {
  return {
    clearError: jest.fn(),
    error: null,
    isAdmin: user?.role === 'admin',
    isSuperAdmin: false,
    loading: false,
    login: jest.fn(async () => undefined),
    logout: jest.fn(async () => undefined),
    refreshUser: jest.fn(async () => undefined),
    user,
  };
}

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, networkMode: 'always', retry: false },
    },
  });
  const providers = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AppThemeProvider>{children}</AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
  return {
    queryClient,
    view: await render(<AdminPlacesScreen />, { wrapper: providers }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue(authValue());
  jest.mocked(placesApi.adminListPlaces).mockImplementation(async (_status, page = 1) => ({
    current_page: page,
    data: [adminPlace],
    last_page: 2,
    total: 2,
  }));
  jest.mocked(placesApi.adminApprove).mockResolvedValue({ id: adminPlace.id, status: 'approved' });
  jest.mocked(placesApi.adminReject).mockResolvedValue({ id: adminPlace.id, status: 'rejected' });
  jest.mocked(placesApi.adminDeletePlace).mockResolvedValue(undefined);
});

test('loads moderation pages and resets paging when the status changes', async () => {
  const { view } = await renderScreen();

  await waitFor(() => expect(view.getByText(adminPlace.name)).toBeTruthy());
  expect(placesApi.adminListPlaces).toHaveBeenCalledWith('pending', 1);

  await fireEvent.press(view.getByText('التالي'));
  await waitFor(() => expect(placesApi.adminListPlaces).toHaveBeenCalledWith('pending', 2));

  await fireEvent.press(view.getByText('مقبول'));
  await waitFor(() => expect(placesApi.adminListPlaces).toHaveBeenCalledWith('approved', 1));
});

test('runs approve and reject operations before refreshing the list', async () => {
  const { view } = await renderScreen();
  await waitFor(() => expect(view.getByTestId(`approve-${adminPlace.id}`)).toBeTruthy());

  await fireEvent.press(view.getByTestId(`approve-${adminPlace.id}`));
  await waitFor(() => expect(placesApi.adminApprove).toHaveBeenCalledWith(adminPlace.id));
  await waitFor(() => expect(placesApi.adminListPlaces).toHaveBeenCalledTimes(2));

  await fireEvent.press(view.getByTestId(`reject-${adminPlace.id}`));
  await waitFor(() => expect(placesApi.adminReject).toHaveBeenCalledWith(adminPlace.id, 'بيانات ناقصة'));
  await waitFor(() => expect(placesApi.adminListPlaces).toHaveBeenCalledTimes(3));
});

test('requires destructive confirmation before deleting a place', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const { view } = await renderScreen();
  await waitFor(() => expect(view.getByTestId(`delete-${adminPlace.id}`)).toBeTruthy());

  await fireEvent.press(view.getByTestId(`delete-${adminPlace.id}`));
  expect(placesApi.adminDeletePlace).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0]?.[2];
  await act(async () => {
    buttons?.find((button) => button.style === 'destructive')?.onPress?.();
  });

  await waitFor(() => expect(placesApi.adminDeletePlace).toHaveBeenCalledWith(adminPlace.id));
  expect(alert).toHaveBeenCalledWith(
    'حذف المكان نهائياً؟',
    `سيتم حذف ${adminPlace.name} وجميع صوره.`,
    expect.any(Array),
  );
});

test('offers login without starting an admin request for signed-out users', async () => {
  const auth = authValue(null);
  jest.mocked(useAuth).mockReturnValue(auth);

  const { view } = await renderScreen();
  await fireEvent.press(view.getByText('تسجيل الدخول'));

  expect(auth.login).toHaveBeenCalledTimes(1);
  expect(placesApi.adminListPlaces).not.toHaveBeenCalled();
});
