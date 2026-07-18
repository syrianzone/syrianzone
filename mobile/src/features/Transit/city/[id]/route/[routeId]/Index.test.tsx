import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import TransitRouteScreen from './Index';

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      city: {
        bounds: [[36, 33], [37, 34]],
        center: [36.5, 33.5],
        id: 'damascus',
        nameAr: 'دمشق',
        nameEn: 'Damascus',
        routeCount: 1,
        status: 'active',
        zoom: 11,
      },
      id: 'route-a',
      route: {
        colorIndex: 2,
        id: 'route-a',
        nameAr: 'خط الاختبار',
        nameEn: 'Test route',
        priceNew: 2500,
        priceOld: 2000,
      },
      stops: [
        {
          coordinates: [36.2, 33.4],
          properties: { id: 'stop-a', nameAr: 'الموقف الأول' },
        },
        {
          coordinates: [36.3, 33.5],
          properties: { id: 'stop-b', nameAr: 'الموقف الثاني' },
        },
      ],
    },
    isError: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'damascus', routeId: 'route-a' }),
}));

function Providers({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

test('shows route fare history, stop total, and a focused map action', async () => {
  const view = await render(<TransitRouteScreen />, { wrapper: Providers });

  expect(view.getByText('عدد المواقف')).toBeTruthy();
  expect(view.getAllByText('٢ موقف').length).toBeGreaterThan(0);
  expect(view.getByText('٢٬٠٠٠ ليرة سورية قديمة')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('فتح خط الاختبار على الخريطة'));
  expect(router.push).toHaveBeenCalledWith({
    params: { id: 'damascus', route: 'route-a' },
    pathname: '/transit/city/[id]/map',
  });
});
