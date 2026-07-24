import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';

import GovAppsPage from '@/features/GovApps/Index';
import PartyPage from '@/features/Party/Index';
import PhonebookPage from '@/features/Phonebook/Index';
import SitesPage from '@/features/Sites/Index';
import OfficialAccountsPage from '@/features/SyOfficial/Index';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import {
  directoryQueryKeys,
  fetchGovernmentApps,
  fetchOfficialAccounts,
  fetchOrganizations,
  fetchPhonebook,
  fetchWebsites,
  organizationSchema,
} from '@/lib/api/directories';

import {
  governmentAppsFixture,
  officialAccountsResponseFixture,
  organizationFixture,
  phonebookFixture,
  websiteFixture,
} from './fixtures/directories';

jest.mock('@/lib/api/directories', () => ({
  ...jest.requireActual('@/lib/api/directories'),
  fetchGovernmentApps: jest.fn(),
  fetchGovernmentStoreIcon: jest.fn(async () => null),
  fetchOfficialAccounts: jest.fn(),
  fetchOrganizations: jest.fn(),
  fetchPhonebook: jest.fn(),
  fetchWebsites: jest.fn(),
}));

async function renderPage(page: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        networkMode: 'always',
        retry: false,
      },
    },
  });
  function Providers({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <AppThemeProvider>{children}</AppThemeProvider>
        </LocaleProvider>
      </QueryClientProvider>
    );
  }

  return {
    queryClient,
    view: await render(page, { wrapper: Providers }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchGovernmentApps).mockResolvedValue([...governmentAppsFixture]);
  jest.mocked(fetchOfficialAccounts).mockResolvedValue({
    categories: [...officialAccountsResponseFixture.data.categories],
    entities: [...officialAccountsResponseFixture.data.entities],
  });
  jest
    .mocked(fetchOrganizations)
    .mockResolvedValue(
      organizationFixture.map((organization) =>
        organizationSchema.parse(organization),
      ),
    );
  jest.mocked(fetchPhonebook).mockResolvedValue([...phonebookFixture]);
  jest.mocked(fetchWebsites).mockResolvedValue([...websiteFixture]);
});

test('official accounts page loads validated directory data', async () => {
  const { view } = await renderPage(<OfficialAccountsPage />);

  expect(view.getByText('روابط الحسابات الرسمية السورية')).toBeTruthy();
  await waitFor(() => expect(view.getByText('وزارة الصحة')).toBeTruthy());
  expect(fetchOfficialAccounts).toHaveBeenCalledTimes(1);
});

test('phonebook page loads the native table view', async () => {
  const { view } = await renderPage(<PhonebookPage />);

  await waitFor(() => expect(view.getByText('الإسعاف')).toBeTruthy());
  expect(view.getByLabelText('قائمة').props.accessibilityState.selected).toBe(
    true,
  );
  expect(fetchPhonebook).toHaveBeenCalledTimes(1);
});

test('sites page retries a failed first request', async () => {
  jest
    .mocked(fetchWebsites)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([...websiteFixture]);
  const { view } = await renderPage(<SitesPage />);

  await waitFor(() =>
    expect(
      view.getByText(
        'تعذر تحميل دليل المواقع. تحقق من اتصالك وحاول مرة أخرى.',
      ),
    ).toBeTruthy(),
  );
  await fireEvent.press(view.getByText('إعادة المحاولة'));
  await waitFor(() => expect(view.getByText('بوابة الخدمات')).toBeTruthy());
  expect(fetchWebsites).toHaveBeenCalledTimes(2);
});

test('party page keeps last-good data visible when refresh fails', async () => {
  const { queryClient, view } = await renderPage(<PartyPage />);
  await waitFor(() =>
    expect(view.getByText('الحزب المدني السوري')).toBeTruthy(),
  );

  jest.mocked(fetchOrganizations).mockRejectedValueOnce(new Error('offline'));
  await queryClient.refetchQueries({ queryKey: directoryQueryKeys.parties });

  await waitFor(() =>
    expect(
      view.getByText('تعذر تحديث الدليل. يتم عرض آخر بيانات محفوظة.'),
    ).toBeTruthy(),
  );
  expect(view.getByText('الحزب المدني السوري')).toBeTruthy();
});

test('government apps page distinguishes a valid empty result', async () => {
  jest.mocked(fetchGovernmentApps).mockResolvedValueOnce([]);
  const { view } = await renderPage(<GovAppsPage />);

  await waitFor(() =>
    expect(view.getByText('لم يتم العثور على تطبيقات')).toBeTruthy(),
  );
  expect(view.getByText('ستظهر التطبيقات الحكومية هنا عند توفرها.')).toBeTruthy();
});

test('sites keep submission and about actions around a valid empty result', async () => {
  jest.mocked(fetchWebsites).mockResolvedValueOnce([]);
  const { view } = await renderPage(<SitesPage />);

  await waitFor(() =>
    expect(view.getByText('لم يتم العثور على مواقع')).toBeTruthy(),
  );
  expect(view.getByText('إضافة موقع جديد')).toBeTruthy();
  expect(view.getByText('حول المواقع السورية')).toBeTruthy();
});

test('party keeps its submission action around a valid empty result', async () => {
  jest.mocked(fetchOrganizations).mockResolvedValueOnce([]);
  const { view } = await renderPage(<PartyPage />);

  await waitFor(() =>
    expect(view.getByText('لم يتم العثور على منظمات')).toBeTruthy(),
  );
  expect(view.getByText('إرسال طلب إضافة للقائمة')).toBeTruthy();
});

test('phonebook keeps its provenance note around a valid empty result', async () => {
  jest.mocked(fetchPhonebook).mockResolvedValueOnce([]);
  const { view } = await renderPage(<PhonebookPage />);

  await waitFor(() => expect(view.getByText('لا توجد نتائج')).toBeTruthy());
  expect(view.getByText('ملاحظات حول أرقام الدليل الخدمي')).toBeTruthy();
});

test('official accounts keep local languages and filters when empty', async () => {
  jest.mocked(fetchOfficialAccounts).mockResolvedValueOnce({
    categories: [],
    entities: [],
  });
  const { view } = await renderPage(<OfficialAccountsPage />);

  await waitFor(() =>
    expect(
      view.getAllByText('لم يتم العثور على حسابات رسمية'),
    ).toHaveLength(2),
  );
  expect(view.getByLabelText('🇹🇷 TR')).toBeTruthy();
  expect(view.getByLabelText('🇬🇧 EN')).toBeTruthy();
});
