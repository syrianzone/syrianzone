import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import GovernmentAppsAdminScreen from '@/features/GovApps/Admin/Index';
import PhonebookAdminScreen from '@/features/Phonebook/Admin/Index';
import SyOfficialAdminScreen from '@/features/SyOfficial/Admin/Index';
import {
  fetchGovernmentAppsAdmin,
  fetchOfficialAdmin,
  fetchPhonebookAdmin,
  type AdminGovernmentApp,
  type AdminOfficialCategory,
  type AdminOfficialEntity,
  type AdminPhonebookCategory,
  type AdminPhonebookEntry,
} from '@/lib/api/directories/admin';
import type { AuthUser } from '@/lib/auth/types';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({
    assets: [
      {
        fileName: 'account-a-secret.jpg',
        uri: 'file:///account-a-secret.jpg',
      },
    ],
    canceled: false,
  })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({
    granted: true,
  })),
}));
jest.mock('@/lib/api/directories/admin', () => {
  const actual =
    jest.requireActual<typeof import('@/lib/api/directories/admin')>(
      '@/lib/api/directories/admin',
    );
  return {
    ...actual,
    fetchGovernmentAppsAdmin: jest.fn(),
    fetchOfficialAdmin: jest.fn(),
    fetchPhonebookAdmin: jest.fn(),
  };
});

const governmentApp: AdminGovernmentApp = {
  description: null,
  description_ar: null,
  icon: null,
  id: 'app',
  images: [],
  is_active: true,
  links: {},
  name: 'App',
  name_ar: 'تطبيق',
  order_column: 0,
};
const phonebookCategory: AdminPhonebookCategory = {
  icon: null,
  id: 'services',
  is_active: true,
  label_ar: 'خدمات',
  label_en: 'Services',
  order_column: 0,
};
const phonebookEntry: AdminPhonebookEntry = {
  category_id: phonebookCategory.id,
  id: 'entry',
  is_active: true,
  is_whatsapp: false,
  name_ar: 'جهة',
  name_en: 'Entry',
  number: '100',
  order_column: 0,
  source_url: null,
};
const officialCategory: AdminOfficialCategory = {
  icon: null,
  id: 'ministries',
  is_active: true,
  label_ar: 'وزارات',
  label_en: 'Ministries',
  order_column: 0,
};
const officialEntity: AdminOfficialEntity = {
  category_id: officialCategory.id,
  description: null,
  description_ar: null,
  id: 'entity',
  image: null,
  is_active: true,
  name: 'Entity',
  name_ar: 'جهة رسمية',
  order_column: 0,
  socials: {},
};

let currentUser: AuthUser;

function user(id: number): AuthUser {
  return {
    avatar_url: null,
    email: `admin-${id}@example.test`,
    id,
    is_banned: false,
    name: `Admin ${id}`,
    permissions: ['*'],
    role: 'user',
  };
}

function authValue() {
  return {
    clearError: jest.fn(),
    error: null,
    isAdmin: false,
    isSuperAdmin: false,
    loading: false,
    login: jest.fn(async () => undefined),
    logout: jest.fn(async () => undefined),
    refreshUser: jest.fn(async () => undefined),
    user: currentUser,
  };
}

async function renderScreen(screen: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AppThemeProvider>{children}</AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
  return {
    queryClient,
    view: await render(screen, { wrapper }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  currentUser = user(7);
  jest.mocked(useAuth).mockImplementation(authValue);
  jest.mocked(fetchGovernmentAppsAdmin).mockResolvedValue([
    governmentApp,
  ]);
  jest.mocked(fetchPhonebookAdmin).mockResolvedValue({
    categories: [phonebookCategory],
    entries: [phonebookEntry],
  });
  jest.mocked(fetchOfficialAdmin).mockResolvedValue({
    categories: [officialCategory],
    entities: [officialEntity],
  });
});

test('resets the government app form and image draft on account switch', async () => {
  const { queryClient, view } = await renderScreen(
    <GovernmentAppsAdminScreen />,
  );
  await waitFor(() => expect(view.getByText('تطبيق')).toBeTruthy());
  await fireEvent.press(view.getByText('تعديل'));
  await fireEvent.changeText(
    view.getByPlaceholderText('الاسم بالعربية'),
    'سر الحساب A',
  );
  await fireEvent.press(view.getByText('اختيار صورة'));
  await waitFor(() =>
    expect(view.getByText('account-a-secret.jpg')).toBeTruthy(),
  );

  queryClient.setQueryData(['admin', 'govapps', 8], [governmentApp]);
  currentUser = user(8);
  view.rerender(<GovernmentAppsAdminScreen />);

  await waitFor(() => expect(view.getByText('إضافة تطبيق')).toBeTruthy());
  expect(
    view.getByPlaceholderText('الاسم بالعربية').props.value,
  ).toBe('');
  expect(view.queryByText('account-a-secret.jpg')).toBeNull();
});

test('resets the phonebook section and form draft on account switch', async () => {
  const { view } = await renderScreen(<PhonebookAdminScreen />);
  await waitFor(() => expect(view.getByText('جهة')).toBeTruthy());
  await fireEvent.press(view.getByText('الفئات'));
  await waitFor(() => expect(view.getByText('إضافة فئة')).toBeTruthy());
  await fireEvent.press(view.getByText('تعديل'));
  await fireEvent.changeText(
    view.getByPlaceholderText('الاسم بالعربية'),
    'سر الحساب A',
  );

  currentUser = user(8);
  view.rerender(<PhonebookAdminScreen />);

  await waitFor(() => expect(view.getByText('إضافة رقم')).toBeTruthy());
  expect(
    view.getByPlaceholderText('اسم الجهة بالعربية').props.value,
  ).toBe('');
  expect(view.queryByText('تعديل الفئة')).toBeNull();
});

test('resets the official section, form, and image draft on account switch', async () => {
  const { view } = await renderScreen(<SyOfficialAdminScreen />);
  await waitFor(() => expect(view.getByText('جهة رسمية')).toBeTruthy());
  await fireEvent.press(view.getByText('تعديل'));
  await fireEvent.changeText(
    view.getByPlaceholderText('الاسم بالعربية'),
    'سر الحساب A',
  );
  await fireEvent.press(view.getByText('اختيار صورة'));
  await waitFor(() =>
    expect(view.getByText('account-a-secret.jpg')).toBeTruthy(),
  );
  await fireEvent.press(view.getByText('الفئات'));
  await waitFor(() => expect(view.getByText('إضافة فئة')).toBeTruthy());

  currentUser = user(8);
  view.rerender(<SyOfficialAdminScreen />);

  await waitFor(() => expect(view.getByText('إضافة جهة')).toBeTruthy());
  expect(
    view.getByPlaceholderText('الاسم بالعربية').props.value,
  ).toBe('');
  expect(view.queryByText('account-a-secret.jpg')).toBeNull();
  expect(view.queryByText('إضافة فئة')).toBeNull();
});
