import { fireEvent, render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import JusticeScreen from './Index';

// The bundled file holds 145 people, and rendering all of them says nothing
// about the count line or the empty state this test covers.
jest.mock('./_data/detainees', () => ({
  __esModule: true,
  default: {
    hierarchy: {
      groups: [],
      root: { name: 'رأس النظام', role: 'قيادة' },
    },
    individuals: [
      { name: 'اسم أول', photo: null, role: 'ضابط' },
      { name: 'اسم ثان', photo: null, role: 'رجل أعمال' },
    ],
    meta: {
      asOf: '2025-06-15',
      rankedTotal: 3696,
      source: 'وزارة الداخلية السورية',
      totalDetainees: 5989,
    },
    ranks: [{ ar: 'لواء', count: 42 }],
  },
}));

function Providers({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

test('justice counts the listed regime figures like the source line does', async () => {
  const view = await render(<JusticeScreen />, { wrapper: Providers });

  expect(view.getByText('2 من رموز النظام')).toBeTruthy();
});

test('justice answers a search with no matches instead of an empty page', async () => {
  const view = await render(<JusticeScreen />, { wrapper: Providers });

  await fireEvent.changeText(
    view.getByPlaceholderText('ابحث بالاسم أو الوصف'),
    'لا يوجد اسم كهذا',
  );
  expect(view.getByText('0 من رموز النظام')).toBeTruthy();
  expect(view.getByText('لا توجد نتائج')).toBeTruthy();
  expect(view.getByText('جرب تغيير مصطلحات البحث')).toBeTruthy();
});
