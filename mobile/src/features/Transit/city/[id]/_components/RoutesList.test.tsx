import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { RoutesList } from './RoutesList';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

function Providers({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

test('shows stop and fare metadata without the removed English route name', async () => {
  const view = await render(
    <RoutesList
      cityId="damascus"
      routes={[
        {
          colorIndex: 2,
          id: 'route-a',
          nameAr: 'البرامكة إلى المزة',
          nameEn: 'Baramkeh to Mezzeh',
          priceNew: 2500,
          stopsCount: 12,
        },
      ]}
    />,
    { wrapper: Providers },
  );

  expect(view.getByText('البرامكة إلى المزة')).toBeTruthy();
  expect(view.queryByText('Baramkeh to Mezzeh')).toBeNull();
  expect(view.getByText('١٢ موقف')).toBeTruthy();
  expect(view.getByText('٢٬٥٠٠ ل.س')).toBeTruthy();
});

test('keeps detail and focused-map actions separate', async () => {
  const view = await render(
    <RoutesList
      cityId="damascus"
      routes={[
        {
          colorIndex: 2,
          id: 'route-a',
          nameAr: 'خط الاختبار',
          stopsCount: 2,
        },
      ]}
    />,
    { wrapper: Providers },
  );

  await fireEvent.press(view.getByLabelText('تفاصيل خط الاختبار'));
  expect(router.push).toHaveBeenLastCalledWith({
    params: { id: 'damascus', routeId: 'route-a' },
    pathname: '/transit/city/[id]/route/[routeId]',
  });

  await fireEvent.press(view.getByLabelText('عرض خط الاختبار على الخريطة'));
  expect(router.push).toHaveBeenLastCalledWith({
    params: { id: 'damascus', route: 'route-a' },
    pathname: '/transit/city/[id]/map',
  });
});
