import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import type { PropsWithChildren } from 'react';

import GovAppsClient from '@/features/GovApps/GovAppsClient';
import PartyClient from '@/features/Party/PartyClient';
import { PhonebookDirectory } from '@/features/Phonebook/Index';
import SitesClient from '@/features/Sites/SitesClient';
import { OfficialDirectory } from '@/features/SyOfficial/Index';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';

import {
  governmentAppsFixture,
  makeOrganizationFixture,
  makeWebsiteFixture,
  officialDirectoryFixture,
  organizationFixture,
  phonebookFixture,
  websiteFixture,
} from './fixtures/directories';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => undefined),
}));

jest.mock('@/lib/linking', () => ({
  ...jest.requireActual('@/lib/linking'),
  openSafeExternalUrl: jest.fn(async () => true),
}));

function FeatureProviders({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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
});

test('official accounts switch language, filter, and open safe social links', async () => {
  const view = await render(
    <OfficialDirectory
      entities={officialDirectoryFixture}
      language="ar"
      onLanguageChange={jest.fn()}
    />,
    { wrapper: FeatureProviders },
  );

  expect(view.getByText('وزارة الصحة')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('الوزارات'));
  expect(view.queryByText('محافظة دمشق')).toBeNull();
  await fireEvent.press(view.getByLabelText('website'));
  expect(openSafeExternalUrl).toHaveBeenCalledWith('https://moh.gov.sy');
});

test('official account callbacks expose all four local language choices', async () => {
  const onLanguageChange = jest.fn();
  const view = await render(
    <OfficialDirectory
      entities={officialDirectoryFixture}
      language="en"
      onLanguageChange={onLanguageChange}
    />,
    { wrapper: FeatureProviders },
  );

  expect(view.getByText('Ministry of Health')).toBeTruthy();
  await fireEvent.changeText(
    view.getByLabelText('Search official accounts by name or description...'),
    'health',
  );
  expect(view.getByLabelText('Clear search')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('🇹🇷 TR'));
  await fireEvent.press(view.getByLabelText('☀️ KU'));
  expect(onLanguageChange).toHaveBeenNthCalledWith(1, 'tr');
  expect(onLanguageChange).toHaveBeenNthCalledWith(2, 'ku');
});

test('phonebook searches normalized numbers and copies the visible result', async () => {
  const view = await render(
    <PhonebookDirectory entries={phonebookFixture} />,
    { wrapper: FeatureProviders },
  );

  await fireEvent.changeText(
    view.getByLabelText('البحث في دليل الهاتف'),
    '963112123456',
  );
  expect(view.getByText('مشفى المواساة')).toBeTruthy();
  expect(view.queryByText('الإسعاف')).toBeNull();
  await fireEvent.press(view.getByLabelText('نسخ الرقم'));
  await waitFor(() =>
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      '+963 (11) 212-3456',
    ),
  );
});

test('phonebook exposes safe call and WhatsApp actions only when applicable', async () => {
  const view = await render(
    <PhonebookDirectory entries={phonebookFixture} />,
    { wrapper: FeatureProviders },
  );

  const callAction = view.getAllByLabelText('اتصال هاتفي')[0];
  expect(callAction).toBeDefined();
  if (callAction) {
    await fireEvent.press(callAction);
  }
  expect(openSafeExternalUrl).toHaveBeenCalledWith('tel:110');

  const whatsAppActions = view.getAllByLabelText('مراسلة عبر واتساب');
  const enabled = whatsAppActions.find(
    (action) => action.props.accessibilityState?.disabled === false,
  );
  expect(enabled).toBeDefined();
  if (enabled) {
    await fireEvent.press(enabled);
  }
  expect(openSafeExternalUrl).toHaveBeenCalledWith(
    'https://wa.me/963933123456',
  );
});

test('sites search, filter, paginate, and open a safe card URL', async () => {
  const view = await render(
    <SitesClient initialWebsites={makeWebsiteFixture(26)} />,
    { wrapper: FeatureProviders },
  );

  expect(view.queryByText('موقع 25')).toBeNull();
  await fireEvent.press(view.getByText('تحميل المزيد'));
  expect(view.getByText('موقع 25')).toBeTruthy();

  await fireEvent.changeText(
    view.getByLabelText('البحث في المواقع السورية'),
    'موقع 03',
  );
  expect(view.getByText('موقع 03')).toBeTruthy();
  expect(view.queryByText('موقع 04')).toBeNull();
  await fireEvent.press(view.getByLabelText('موقع 03'));
  expect(openSafeExternalUrl).toHaveBeenCalledWith(
    'https://site-3.example.com',
  );
});

test('sites clear action restores all raw types', async () => {
  const view = await render(
    <SitesClient initialWebsites={websiteFixture} />,
    { wrapper: FeatureProviders },
  );

  await fireEvent.press(view.getByLabelText('المواقع التعريفية'));
  expect(view.getByText('بوابة الخدمات')).toBeTruthy();
  expect(view.queryByText('مجلة الشام')).toBeNull();
  await fireEvent.press(view.getByText('مسح الفلاتر'));
  expect(view.getByText('مجلة الشام')).toBeTruthy();
});

test('party filters exact country values and snaps pagination back like the source', async () => {
  const view = await render(
    <PartyClient initialOrganizations={makeOrganizationFixture(16)} />,
    { wrapper: FeatureProviders },
  );

  expect(view.getByText('منظمة 15')).toBeTruthy();
  expect(view.queryByText('منظمة 16')).toBeNull();
  await fireEvent.press(view.getByText('تحميل المزيد'));
  expect(view.getByText('منظمة 16')).toBeTruthy();
  await fireEvent.press(view.getByLabelText('دمشق'));
  expect(view.getByText('منظمة 15')).toBeTruthy();
  await fireEvent.press(view.getByText('مسح الفلاتر'));
  expect(view.queryByText('منظمة 16')).toBeNull();
});

test('party cards expose source website and social formatting', async () => {
  const view = await render(
    <PartyClient initialOrganizations={organizationFixture} />,
    { wrapper: FeatureProviders },
  );

  const xAction = view.getAllByLabelText('X')[0];
  expect(xAction).toBeDefined();
  if (xAction) {
    await fireEvent.press(xAction);
  }
  expect(openSafeExternalUrl).toHaveBeenCalledWith(
    'https://x.com/civicparty',
  );
  await fireEvent.press(view.getByLabelText('ألمانيا'));
  expect(view.getByText('المبادرة السورية الأوروبية')).toBeTruthy();
  expect(view.queryByText('الحزب المدني السوري')).toBeNull();
});

test('government app cards use database media and expandable descriptions without a gallery', async () => {
  const app = governmentAppsFixture[0];
  expect(app).toBeDefined();
  if (!app) {
    return;
  }
  const databaseIcon = 'https://media.example.com/govapps/services.webp';
  const view = await render(
    <GovAppsClient initialData={[{ ...app, icon: databaseIcon }]} />,
    { wrapper: FeatureProviders },
  );

  expect(view.getByLabelText('أيقونة خدماتي').props.source).toEqual([
    { uri: databaseIcon },
  ]);
  const description = view.getByText(app.description);
  expect(description.props.numberOfLines).toBe(2);
  await fireEvent.press(view.getByTestId('govapp-description-services'));
  await waitFor(() =>
    expect(view.getByText(app.description).props.numberOfLines).toBeUndefined(),
  );
  expect(view.queryByText('لقطات الشاشة')).toBeNull();
  expect(view.queryByLabelText('لقطة شاشة 1 من خدماتي')).toBeNull();
});

test('government app store actions use the shared safe linking helper', async () => {
  const view = await render(
    <GovAppsClient initialData={governmentAppsFixture.slice(0, 1)} />,
    { wrapper: FeatureProviders },
  );

  await fireEvent.press(view.getByLabelText('أندرويد'));
  expect(openSafeExternalUrl).toHaveBeenCalledWith(
    'https://play.google.com/store/apps/details?id=sy.gov.services',
  );
});

test('government apps use the fixed first-party fallback when database media is missing', async () => {
  const app = governmentAppsFixture[1];
  expect(app).toBeDefined();
  if (!app) {
    return;
  }
  const view = await render(<GovAppsClient initialData={[app]} />, {
    wrapper: FeatureProviders,
  });

  expect(view.getByLabelText('أيقونة البلاغات الرسمية').props.source).toEqual([
    {
      uri: 'https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/govapps/mofa/icon.webp',
    },
  ]);
});
