import { render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import type { City } from '../../_types';
import { Hero } from './Hero';

function Providers({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

const city = (input: Partial<City>): City => ({
  bounds: null,
  center: [36, 33],
  id: 'damascus',
  nameAr: 'دمشق',
  nameEn: 'Damascus',
  routeCount: 0,
  status: 'active',
  zoom: 11,
  ...input,
});

test('shows ready city and published route totals from the visible data', async () => {
  const view = await render(
    <Hero
      cities={[
        city({ id: 'damascus', routeCount: 4 }),
        city({ id: 'hama', routeCount: 2 }),
        city({ id: 'idlib', routeCount: 0 }),
      ]}
    />,
    { wrapper: Providers },
  );

  expect(view.getByText('مدن جاهزة')).toBeTruthy();
  expect(view.getByText('خط سيرفيس')).toBeTruthy();
  expect(view.getByText('٢')).toBeTruthy();
  expect(view.getByText('٦')).toBeTruthy();
  expect(
    view.getByText(/يجمعها المجتمع ويحدّثها، ومتاحة للجميع مجاناً/),
  ).toBeTruthy();
});
