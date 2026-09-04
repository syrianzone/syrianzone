import { fireEvent, render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';
import { makeOrganizationFixture } from '@/test/fixtures/directories';

import PartyClient from './PartyClient';

jest.mock('@/lib/linking', () => ({
  ...jest.requireActual('@/lib/linking'),
  openSafeExternalUrl: jest.fn(async () => true),
}));

function Providers({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

async function renderParty(count: number) {
  return render(
    <PartyClient initialOrganizations={makeOrganizationFixture(count)} />,
    { wrapper: Providers },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('party offers the source header call to action for a new organization', async () => {
  const view = await renderParty(2);

  await fireEvent.press(view.getByLabelText('إضافة منظمة جديدة'));
  expect(openSafeExternalUrl).toHaveBeenCalledWith(
    'https://forms.gle/vLAxoz5RNt6z6qyj9',
  );
});

test('party snaps back to the first fifteen rows when a filter changes', async () => {
  const view = await renderParty(32);

  await fireEvent.press(view.getByText('تحميل المزيد'));
  expect(view.getByText('عرض 30 من أصل 32 منظمة')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('حلب'));
  expect(view.getByText('عرض 15 من أصل 16 منظمة')).toBeTruthy();
  expect(view.queryByText('منظمة 32')).toBeNull();
});

test('party snaps back to the first fifteen rows when the search changes', async () => {
  const view = await renderParty(32);

  await fireEvent.press(view.getByText('تحميل المزيد'));
  expect(view.getByText('منظمة 30')).toBeTruthy();

  await fireEvent.changeText(
    view.getByLabelText('البحث في المنظمات السياسية'),
    'منظمة',
  );
  expect(view.getByText('عرض 15 من أصل 32 منظمة')).toBeTruthy();
  expect(view.queryByText('منظمة 30')).toBeNull();
});
