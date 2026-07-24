import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { fetchAdminPollCatalog } from '@/components/admin/api';

import { fetchDashboardAccount } from './api';
import Dashboard from './Index';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

jest.mock('expo-image-picker', () => ({
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

jest.mock('@/components/admin/api', () => ({
  deleteAdminPoll: jest.fn(),
  fetchAdminPollCatalog: jest.fn(),
}));

jest.mock('@/features/Admin/Polls/Create', () => () => null);
jest.mock('@/features/Admin/Polls/Edit', () => () => null);

jest.mock('./api', () => ({
  deleteDashboardAccount: jest.fn(),
  fetchDashboardAccount: jest.fn(),
  updateDashboardAccount: jest.fn(),
  updateDashboardAvatar: jest.fn(),
  withdrawDashboardDraft: jest.fn(),
}));

const user = {
  avatar_url: 'https://cdn.example.test/broken-avatar.jpg',
  email: 'layla@example.test',
  id: 7,
  is_banned: false,
  name: 'ليلى',
  role: 'user',
};

function Providers({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, retry: false },
    },
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
  jest.mocked(fetchAdminPollCatalog).mockResolvedValue([]);
  jest.mocked(useAuth).mockReturnValue({
    clearError: jest.fn(),
    error: null,
    isAdmin: false,
    isSuperAdmin: false,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    user,
  });
  jest.mocked(fetchDashboardAccount).mockResolvedValue({
    myDrafts: [
      {
        city: { id: 'damascus', name_ar: 'دمشق', name_en: 'Damascus' },
        city_id: 'damascus',
        created_at: '2026-07-23T10:00:00Z',
        id: 41,
        name_ar: 'مسودة جديدة',
        name_en: null,
        notes: null,
        price: null,
        rejection_reason: null,
        route_id: null,
        status: 'pending',
        user_id: 7,
      },
      {
        city: { id: 'damascus', name_ar: 'دمشق', name_en: 'Damascus' },
        city_id: 'damascus',
        created_at: '2026-07-24T10:00:00Z',
        id: 42,
        name_ar: 'تعديل خط منشور',
        name_en: null,
        notes: null,
        price: null,
        rejection_reason: null,
        route_id: 'route-damascus-a',
        status: 'approved',
        user_id: 7,
      },
    ],
    user,
  });
});

test('opens draft editing and published route journeys from submissions', async () => {
  const view = await render(<Dashboard />, { wrapper: Providers });

  await waitFor(() => expect(view.getByText('مسودة جديدة')).toBeTruthy());
  expect(view.getByText('تعديل مقترح لخط منشور')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('تعديل مسودة جديدة'));
  expect(router.push).toHaveBeenCalledWith({
    params: { edit: '41' },
    pathname: '/transit/studio',
  });

  await fireEvent.press(view.getByLabelText('عرض تعديل خط منشور'));
  expect(router.push).toHaveBeenCalledWith({
    params: { id: 'damascus', routeId: 'route-damascus-a' },
    pathname: '/transit/city/[id]/route/[routeId]',
  });
});

test('falls back to initials when the dashboard avatar cannot load', async () => {
  const view = await render(<Dashboard />, { wrapper: Providers });

  await waitFor(() => expect(view.getByText('مسودة جديدة')).toBeTruthy());
  await fireEvent.press(view.getByText('إعدادات الحساب'));
  await fireEvent(view.getByTestId('avatar-image'), 'error', {
    nativeEvent: { error: 'network' },
  });

  expect(view.getByLabelText('ليلى')).toBeTruthy();
  expect(view.queryByTestId('avatar-image')).toBeNull();
});

test('exposes each directory admin screen through granular permissions', async () => {
  const permittedUser = {
    ...user,
    permissions: [
      'govapps.edit',
      'phonebook.create',
      'syofficial.toggle',
    ],
  };
  jest.mocked(useAuth).mockReturnValue({
    clearError: jest.fn(),
    error: null,
    isAdmin: false,
    isSuperAdmin: false,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    user: permittedUser,
  });
  jest.mocked(fetchDashboardAccount).mockResolvedValue({
    myDrafts: [],
    user: permittedUser,
  });

  const view = await render(<Dashboard />, { wrapper: Providers });

  await waitFor(() =>
    expect(view.getByText('إدارة التطبيقات الحكومية')).toBeTruthy(),
  );
  await fireEvent.press(view.getByText('إدارة التطبيقات الحكومية'));
  await fireEvent.press(view.getByText('إدارة دليل الهاتف'));
  await fireEvent.press(view.getByText('إدارة الحسابات الرسمية'));

  expect(router.push).toHaveBeenCalledWith('/admin/govapps');
  expect(router.push).toHaveBeenCalledWith('/admin/phonebook');
  expect(router.push).toHaveBeenCalledWith('/admin/syofficial');
});

test('exposes Transit admin to an ordinary granular permission holder', async () => {
  const permittedUser = {
    ...user,
    permissions: ['transit.view_logs'],
  };
  jest.mocked(useAuth).mockReturnValue({
    clearError: jest.fn(),
    error: null,
    isAdmin: false,
    isSuperAdmin: false,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    user: permittedUser,
  });
  jest.mocked(fetchDashboardAccount).mockResolvedValue({
    myDrafts: [],
    user: permittedUser,
  });

  const view = await render(<Dashboard />, { wrapper: Providers });

  await waitFor(() =>
    expect(view.getByText('إدارة الترانزيت')).toBeTruthy(),
  );
  await fireEvent.press(view.getByText('إدارة الترانزيت'));

  expect(router.push).toHaveBeenCalledWith('/transit/admin');
});

test('exposes all directory admin screens to an overriding admin role', async () => {
  const adminUser = { ...user, role: 'admin' };
  jest.mocked(useAuth).mockReturnValue({
    clearError: jest.fn(),
    error: null,
    isAdmin: true,
    isSuperAdmin: false,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    user: adminUser,
  });
  jest.mocked(fetchDashboardAccount).mockResolvedValue({
    myDrafts: [],
    user: adminUser,
  });

  const view = await render(<Dashboard />, { wrapper: Providers });

  await waitFor(() =>
    expect(view.getByText('إدارة التطبيقات الحكومية')).toBeTruthy(),
  );
  expect(view.getByText('إدارة دليل الهاتف')).toBeTruthy();
  expect(view.getByText('إدارة الحسابات الرسمية')).toBeTruthy();
});

test('does not expose directory admin screens to an ordinary account', async () => {
  const view = await render(<Dashboard />, { wrapper: Providers });

  await waitFor(() => expect(view.getByText('مسودة جديدة')).toBeTruthy());
  expect(view.queryByText('إدارة التطبيقات الحكومية')).toBeNull();
  expect(view.queryByText('إدارة دليل الهاتف')).toBeNull();
  expect(view.queryByText('إدارة الحسابات الرسمية')).toBeNull();
});
