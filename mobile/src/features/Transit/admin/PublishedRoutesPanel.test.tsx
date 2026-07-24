import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import {
  getPublishedRouteGeoJson,
  getPublishedRouteStops,
  getPublishedRoutes,
  getTransitRouteLogs,
  updatePublishedRoute,
  updatePublishedRouteStatus,
} from '../api';
import {
  TRANSIT_ADMIN_PERMISSIONS,
  transitAdminAccess,
  type TransitAdminAccess,
} from './model';
import { PublishedRoutesPanel } from './PublishedRoutesPanel';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('../_components/citymap/MapView', () => ({
  TransitMapView: () => null,
}));

jest.mock('../_hooks/useMapData', () => ({
  useMapData: () => ({ data: null }),
}));

jest.mock('../api', () => ({
  combinePublishedRoutes: jest.fn(),
  getPublishedRouteGeoJson: jest.fn(),
  getPublishedRouteStops: jest.fn(),
  getPublishedRoutes: jest.fn(),
  getTransitRouteLogs: jest.fn(),
  movePublishedRoute: jest.fn(),
  splitPublishedRoute: jest.fn(),
  updatePublishedRoute: jest.fn(),
  updatePublishedRouteStatus: jest.fn(),
}));

const route = {
  city: { name_ar: 'دمشق', name_en: 'Damascus' },
  city_id: 'damascus',
  color_index: 3,
  created_at: '2026-07-24T10:00:00Z',
  id: 'route-a',
  name_ar: 'خط تجريبي',
  name_en: 'Test route',
  price_new: 2_500,
  price_old: 2_000,
  status: 'published' as const,
  stops_count: 3,
};

const cities = [
  {
    bounds: null,
    center: [36.29, 33.51] as [number, number],
    id: 'damascus',
    nameAr: 'دمشق',
    nameEn: 'Damascus',
    routeCount: 1,
    status: 'active' as const,
    zoom: 11,
  },
  {
    bounds: null,
    center: [36.75, 35.13] as [number, number],
    id: 'hama',
    nameAr: 'حماة',
    nameEn: 'Hama',
    routeCount: 1,
    status: 'active' as const,
    zoom: 11,
  },
];

function access(
  ...permissions: (typeof TRANSIT_ADMIN_PERMISSIONS)[keyof typeof TRANSIT_ADMIN_PERMISSIONS][]
): TransitAdminAccess {
  return transitAdminAccess({
    is_banned: false,
    permissions,
    role: 'user',
  });
}

function Providers({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: 0 },
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
  jest.mocked(getPublishedRoutes).mockResolvedValue([route]);
  jest.mocked(getTransitRouteLogs).mockResolvedValue([
    {
      action: 'moved',
      created_at: '2026-07-24T10:00:00Z',
      description: 'نقل الخط إلى مدينة حماة',
      id: 1,
      route_id: route.id,
      user: { name: 'مدير' },
    },
  ]);
  jest.mocked(getPublishedRouteGeoJson).mockResolvedValue({
    features: [],
    type: 'FeatureCollection',
  });
  jest.mocked(getPublishedRouteStops).mockResolvedValue([
    {
      coordinates: [36.2, 33.4],
      id: 'stop-a',
      name_ar: 'الموقف الأول',
    },
    {
      coordinates: [36.25, 33.45],
      id: 'stop-b',
      name_ar: 'الموقف الأوسط',
    },
    {
      coordinates: [36.3, 33.5],
      id: 'stop-c',
      name_ar: 'الموقف الأخير',
    },
  ]);
  jest.mocked(updatePublishedRouteStatus).mockResolvedValue(undefined);
  jest.mocked(updatePublishedRoute).mockResolvedValue(undefined);
});

test('edits the returned route color through the accessible selector', async () => {
  const view = await render(
    <PublishedRoutesPanel
      access={transitAdminAccess({
        is_banned: false,
        permissions: [],
        role: 'transit_admin',
      })}
      accountId={7}
      cities={cities}
    />,
    { wrapper: Providers },
  );

  await waitFor(() => expect(view.getByText('خط تجريبي')).toBeTruthy());
  fireEvent.press(view.getByLabelText('إدارة خط تجريبي'));
  await waitFor(() =>
    expect(
      view.getByRole('radio', { name: 'لون المسار 4' }).props
        .accessibilityState,
    ).toEqual({ checked: true }),
  );

  fireEvent.press(view.getByRole('radio', { name: 'لون المسار 7' }));
  await waitFor(() =>
    expect(
      view.getByRole('radio', { name: 'لون المسار 7' }).props
        .accessibilityState,
    ).toEqual({ checked: true }),
  );
  await act(async () => {
    fireEvent.press(view.getByText('حفظ بيانات الخط'));
  });

  await waitFor(() =>
    expect(updatePublishedRoute).toHaveBeenCalledWith('route-a', {
      colorIndex: 6,
      nameAr: 'خط تجريبي',
      nameEn: 'Test route',
      priceNew: 2_500,
      priceOld: 2_000,
    }),
  );
  await waitFor(() =>
    expect(view.getByText('تم تحديث بيانات الخط.')).toBeTruthy(),
  );
  await waitFor(() => expect(getPublishedRoutes).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(
      view.getByRole('button', { name: 'حفظ بيانات الخط' }),
    ).toBeEnabled(),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

test('surfaces every published route action and opens geometry editing', async () => {
  const view = await render(
    <PublishedRoutesPanel
      access={transitAdminAccess({
        is_banned: false,
        permissions: [],
        role: 'transit_admin',
      })}
      accountId={7}
      cities={cities}
    />,
    { wrapper: Providers },
  );

  await waitFor(() => expect(view.getByText('خط تجريبي')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('إدارة خط تجريبي'));
  await waitFor(() =>
    expect(view.getAllByText(/الموقف الأوسط/).length).toBeGreaterThan(0),
  );

  expect(view.getByText('إخفاء الخط')).toBeTruthy();
  expect(view.getByText('تعطيل الخط')).toBeTruthy();
  expect(view.getByText('حفظ بيانات الخط')).toBeTruthy();
  expect(view.getByText('نقل الخط')).toBeTruthy();
  expect(view.getByText('تقسيم الخط')).toBeTruthy();
  expect(view.getByText('دمج خطين')).toBeTruthy();
  expect(view.getByText('سجل النشاط')).toBeTruthy();

  await act(async () => {
    fireEvent.press(view.getByText('إخفاء الخط'));
  });
  await waitFor(() =>
    expect(updatePublishedRouteStatus).toHaveBeenCalledWith('route-a', 'hidden'),
  );
  await waitFor(() => expect(view.getByText('تم إخفاء الخط.')).toBeTruthy());
  await waitFor(() => expect(getPublishedRoutes).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(view.getByRole('button', { name: 'إخفاء الخط' })).toBeEnabled(),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  await fireEvent.press(view.getByText('تعديل المسار على الخريطة'));
  expect(router.push).toHaveBeenCalledWith({
    params: { edit: 'route-a' },
    pathname: '/transit/studio',
  });
});

test('loads and displays only logs for a view-logs permission holder', async () => {
  const view = await render(
    <PublishedRoutesPanel
      access={access(TRANSIT_ADMIN_PERMISSIONS.viewLogs)}
      accountId={7}
      cities={cities}
    />,
    { wrapper: Providers },
  );

  await waitFor(() =>
    expect(view.getByText('نقل الخط إلى مدينة حماة')).toBeTruthy(),
  );
  expect(getTransitRouteLogs).toHaveBeenCalledTimes(1);
  expect(getPublishedRoutes).not.toHaveBeenCalled();
  expect(view.getByText('سجل النشاط')).toBeTruthy();
  expect(view.queryByText('دمج خطين')).toBeNull();
  expect(view.queryByText('نقل الخط')).toBeNull();
  expect(view.queryByText('تقسيم الخط')).toBeNull();
});

test('loads route details only for edit permission and hides other actions', async () => {
  const view = await render(
    <PublishedRoutesPanel
      access={access(TRANSIT_ADMIN_PERMISSIONS.editRoutes)}
      accountId={7}
      cities={cities}
    />,
    { wrapper: Providers },
  );

  await waitFor(() => expect(view.getByText('خط تجريبي')).toBeTruthy());
  expect(getPublishedRoutes).toHaveBeenCalledTimes(1);
  expect(getTransitRouteLogs).not.toHaveBeenCalled();

  fireEvent.press(view.getByLabelText('إدارة خط تجريبي'));
  await waitFor(() =>
    expect(getPublishedRouteGeoJson).toHaveBeenCalledWith('route-a'),
  );
  await waitFor(() =>
    expect(getPublishedRouteStops).toHaveBeenCalledWith('route-a'),
  );

  expect(view.getByText('حفظ بيانات الخط')).toBeTruthy();
  expect(view.getByText('تعديل المسار على الخريطة')).toBeTruthy();
  expect(view.queryByText('نقل الخط')).toBeNull();
  expect(view.queryByText('تقسيم الخط')).toBeNull();
  expect(view.queryByText('دمج خطين')).toBeNull();
  expect(view.queryByText('سجل النشاط')).toBeNull();
});

test('hides cached route details when edit permission is removed', async () => {
  const view = await render(
    <PublishedRoutesPanel
      access={access(TRANSIT_ADMIN_PERMISSIONS.editRoutes)}
      accountId={7}
      cities={cities}
    />,
    { wrapper: Providers },
  );

  await waitFor(() => expect(view.getByText('خط تجريبي')).toBeTruthy());
  fireEvent.press(view.getByLabelText('إدارة خط تجريبي'));
  await waitFor(() =>
    expect(view.getByText('حفظ بيانات الخط')).toBeTruthy(),
  );

  view.rerender(
    <PublishedRoutesPanel
      access={access(TRANSIT_ADMIN_PERMISSIONS.viewLogs)}
      accountId={7}
      cities={cities}
    />,
  );

  await waitFor(() => expect(view.getByText('سجل النشاط')).toBeTruthy());
  expect(view.queryByText('حفظ بيانات الخط')).toBeNull();
  expect(view.queryByText('تعديل المسار على الخريطة')).toBeNull();
});

test.each([
  {
    allowed: 'نقل الخط',
    denied: ['تقسيم الخط', 'دمج خطين', 'سجل النشاط'],
    placeholder: 'معرف الخط المراد نقله',
    permission: TRANSIT_ADMIN_PERMISSIONS.moveRoutes,
  },
  {
    allowed: 'تقسيم الخط',
    denied: ['نقل الخط', 'دمج خطين', 'سجل النشاط'],
    placeholder: 'معرف الخط المراد تقسيمه',
    permission: TRANSIT_ADMIN_PERMISSIONS.splitRoutes,
  },
  {
    allowed: 'دمج خطين',
    denied: ['نقل الخط', 'تقسيم الخط', 'سجل النشاط'],
    placeholder: 'معرف الخط الأول',
    permission: TRANSIT_ADMIN_PERMISSIONS.combineRoutes,
  },
])(
  'shows only the $permission published-route action without route-list access',
  async ({ allowed, denied, permission, placeholder }) => {
    const view = await render(
      <PublishedRoutesPanel
        access={access(permission)}
        accountId={7}
        cities={cities}
      />,
      { wrapper: Providers },
    );

    await waitFor(() => expect(view.getByText(allowed)).toBeTruthy());
    expect(view.getByPlaceholderText(placeholder)).toBeTruthy();
    expect(getPublishedRoutes).not.toHaveBeenCalled();
    expect(getTransitRouteLogs).not.toHaveBeenCalled();
    for (const label of denied) {
      expect(view.queryByText(label)).toBeNull();
    }
  },
);
