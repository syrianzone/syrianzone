import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';

import { CentralDirectory } from './Index';
import type { CentralDirectoryData } from './model';

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

const data: CentralDirectoryData = {
  governorates: [
    {
      id: 'damascus',
      links: [
        {
          label: 'الموقع الرسمي لمحافظة دمشق',
          type: 'website',
          value: 'https://damascus.example',
        },
      ],
      nameAr: 'دمشق',
      nameEn: 'Damascus',
    },
  ],
  presidency: {
    entities: [
      {
        head: 'عامر العلي',
        id: 'inspection',
        image: '',
        links: [],
        name: 'الهيئة المركزية للرقابة والتفتيش',
      },
    ],
    ministries: [
      {
        head: 'يعرب بدر',
        id: 'transport',
        image: '',
        links: [],
        name: 'وزارة النقل',
      },
    ],
  },
};

beforeEach(() => jest.clearAllMocks());

test('searches and filters the central directory, then opens card details', async () => {
  const view = await render(<CentralDirectory data={data} />, {
    wrapper: Providers,
  });

  expect(view.getByText('دمشق')).toBeTruthy();
  expect(view.getByText('وزارة النقل')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('الوزارات'));
  await waitFor(() => {
    expect(view.queryByText('دمشق')).toBeNull();
    expect(view.getByText('وزارة النقل')).toBeTruthy();
  });

  await fireEvent.press(view.getByLabelText('الكل'));
  await fireEvent.changeText(
    view.getByLabelText('البحث في الدليل المركزي'),
    'عامر',
  );
  await waitFor(() => {
    expect(view.getByText('الهيئة المركزية للرقابة والتفتيش')).toBeTruthy();
    expect(view.queryByText('وزارة النقل')).toBeNull();
  });

  await fireEvent.press(
    view.getByLabelText('عرض تفاصيل الهيئة المركزية للرقابة والتفتيش'),
  );
  expect(view.getByText('الرئيس/المدير المسؤول: عامر العلي')).toBeTruthy();
  expect(view.getByText('لا توجد روابط اتصال مسجلة حالياً')).toBeTruthy();
});

test('opens safe official links from the detail sheet', async () => {
  const view = await render(<CentralDirectory data={data} />, {
    wrapper: Providers,
  });

  await fireEvent.press(view.getByLabelText('عرض تفاصيل دمشق'));
  await fireEvent.press(
    await view.findByLabelText('الموقع الرسمي لمحافظة دمشق'),
  );

  expect(openSafeExternalUrl).toHaveBeenCalledWith('https://damascus.example');
});
