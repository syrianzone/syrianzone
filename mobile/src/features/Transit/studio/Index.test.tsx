import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import {
  getPublishedRouteForEdit,
  getTransitStudioDraft,
  saveRouteDraft,
} from '../api';
import { useStudioStore } from '../_store/useStudioStore';
import TransitStudioScreen from './Index';

let mockEditParam: string | undefined;
let mockMapPressCount = 0;
let mockUserId: number | null;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ edit: mockEditParam }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    loading: false,
    user:
      mockUserId === null
        ? null
        : {
            id: mockUserId,
          },
  }),
}));

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  getPublishedRouteForEdit: jest.fn(),
  getTransitStudioDraft: jest.fn(),
  saveRouteDraft: jest.fn(),
}));

jest.mock('../_hooks/useMapData', () => ({
  useMapData: () => ({ data: null }),
}));

jest.mock('../_components/citymap/MapView', () => ({
  TransitMapView: ({
    onMapPress,
  }: {
    onMapPress?: (coordinate: [number, number]) => void;
  }) => {
    const { Pressable } = jest.requireActual<typeof import('react-native')>(
      'react-native',
    );
    return (
      <Pressable
        onPress={() => {
          mockMapPressCount += 1;
          onMapPress?.([
            Number((36.2 + mockMapPressCount / 100).toFixed(2)),
            Number((33.4 + mockMapPressCount / 100).toFixed(2)),
          ]);
        }}
        testID="studio-map"
      />
    );
  },
}));

function Providers({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: 0, retry: false },
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
  mockEditParam = undefined;
  mockMapPressCount = 0;
  mockUserId = 7;
  jest.clearAllMocks();
  useStudioStore.getState().reset();
  jest.mocked(saveRouteDraft).mockResolvedValue({ id: 77 });
});

test('moves through five distinct contribution steps before submission', async () => {
  const view = await render(<TransitStudioScreen />, { wrapper: Providers });

  expect(view.getByText('1. اختر المدينة')).toBeTruthy();
  expect(view.queryByText('2. ارسم المسار')).toBeNull();

  await fireEvent.press(view.getByTestId('transit-studio-city-damascus'));
  expect(view.getByText('2. ارسم المسار')).toBeTruthy();
  await fireEvent.press(view.getByTestId('studio-map'));
  await fireEvent.press(view.getByTestId('studio-map'));
  await fireEvent.press(view.getByText('التالي: المحطات'));

  expect(view.getByText('3. أسماء المحطات')).toBeTruthy();
  await fireEvent.press(view.getByText('التالي: معلومات الخط'));
  await fireEvent.changeText(
    view.getByPlaceholderText('اسم الخط بالعربية'),
    'خط تجريبي',
  );
  await fireEvent.press(view.getByText('التالي: المراجعة'));

  expect(view.getByText('5. مراجعة المسار')).toBeTruthy();
  expect(view.getByText('خط تجريبي')).toBeTruthy();
  await fireEvent.press(view.getByText('إرسال للمراجعة'));
  await waitFor(() => expect(saveRouteDraft).toHaveBeenCalledWith(
    expect.objectContaining({
      coordinates: expect.arrayContaining([[36.21, 33.41], [36.22, 33.42]]),
      nameAr: 'خط تجريبي',
    }),
  ));
});

test('loads an edit deep link and saves it to the owned draft', async () => {
  mockEditParam = '42';
  jest.mocked(getTransitStudioDraft).mockResolvedValue({
    city_id: 'damascus',
    geojson: {
      features: [{
        geometry: {
          coordinates: [[36.2, 33.4], [36.3, 33.5]],
          type: 'LineString',
        },
        properties: {},
        type: 'Feature',
      }],
      type: 'FeatureCollection',
    },
    id: 42,
    name_ar: 'مسار محفوظ',
    name_en: null,
    notes: null,
    price: null,
    route_id: null,
  });

  const view = await render(<TransitStudioScreen />, { wrapper: Providers });

  await waitFor(() => expect(view.getByText('مسار محفوظ')).toBeTruthy());
  expect(getTransitStudioDraft).toHaveBeenCalledWith(42);
  expect(getPublishedRouteForEdit).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText('حفظ التعديلات'));
  await waitFor(() => expect(saveRouteDraft).toHaveBeenCalledWith(
    expect.objectContaining({ draftId: 42, nameAr: 'مسار محفوظ' }),
  ));
});

test('starts a clean draft and removes the edit deep link after saving', async () => {
  mockEditParam = '42';
  jest.mocked(getTransitStudioDraft).mockResolvedValue({
    city_id: 'damascus',
    geojson: {
      features: [{
        geometry: {
          coordinates: [[36.2, 33.4], [36.3, 33.5]],
          type: 'LineString',
        },
        properties: {},
        type: 'Feature',
      }],
      type: 'FeatureCollection',
    },
    id: 42,
    name_ar: 'مسار محفوظ',
    name_en: null,
    notes: null,
    price: null,
    route_id: null,
  });

  const view = await render(<TransitStudioScreen />, { wrapper: Providers });
  await waitFor(() => expect(view.getByText('مسار محفوظ')).toBeTruthy());

  await fireEvent.press(view.getByText('حفظ التعديلات'));
  await waitFor(() =>
    expect(view.getByText('تم إرسال تعديلات المسار بنجاح.')).toBeTruthy(),
  );
  await fireEvent.press(view.getByText('بدء مسودة جديدة'));

  expect(router.replace).toHaveBeenCalledWith('/transit/studio');
  expect(view.getByText('1. اختر المدينة')).toBeTruthy();
  expect(useStudioStore.getState()).toMatchObject({
    editAccountId: 7,
    editingDraftId: null,
    editingRouteId: null,
    editTarget: null,
    isEditMode: false,
    step: 1,
  });
  expect(getTransitStudioDraft).toHaveBeenCalledTimes(1);
});

test('loads a published route deep link and submits a linked draft', async () => {
  mockEditParam = 'route-damascus-a';
  jest.mocked(getPublishedRouteForEdit).mockResolvedValue({
    city_id: 'damascus',
    geojson: {
      features: [{
        geometry: {
          coordinates: [[36.2, 33.4], [36.3, 33.5]],
          type: 'LineString',
        },
        properties: {},
        type: 'Feature',
      }],
      type: 'FeatureCollection',
    },
    id: 'route-damascus-a',
    is_published_route: true,
    name_ar: 'خط منشور',
    name_en: null,
    notes: null,
    price: null,
    route_id: 'route-damascus-a',
  });

  const view = await render(<TransitStudioScreen />, { wrapper: Providers });

  await waitFor(() => expect(view.getByText('خط منشور')).toBeTruthy());
  expect(getPublishedRouteForEdit).toHaveBeenCalledWith('route-damascus-a');
  await fireEvent.press(view.getByText('حفظ التعديلات'));
  await waitFor(() => expect(saveRouteDraft).toHaveBeenCalledWith(
    expect.objectContaining({
      nameAr: 'خط منشور',
      routeId: 'route-damascus-a',
    }),
  ));
});

test('does not reinterpret an inaccessible draft ID as a published route', async () => {
  mockEditParam = '42';
  jest.mocked(getTransitStudioDraft).mockRejectedValue(
    new Error('Draft not found'),
  );

  const view = await render(<TransitStudioScreen />, { wrapper: Providers });

  await waitFor(() =>
    expect(view.getByText('تعذر تحميل المسار للتعديل.')).toBeTruthy(),
  );
  expect(getTransitStudioDraft).toHaveBeenCalledWith(42);
  expect(getPublishedRouteForEdit).not.toHaveBeenCalled();
  expect(view.queryByText('حفظ التعديلات')).toBeNull();
});

test('clears and reloads an owned draft when the signed-in account changes', async () => {
  mockEditParam = '42';
  jest.mocked(getTransitStudioDraft)
    .mockResolvedValueOnce({
      city_id: 'damascus',
      geojson: {
        features: [{
          geometry: {
            coordinates: [[36.2, 33.4], [36.3, 33.5]],
            type: 'LineString',
          },
          properties: {},
          type: 'Feature',
        }],
        type: 'FeatureCollection',
      },
      id: 42,
      name_ar: 'مسودة الحساب الأول',
      name_en: null,
      notes: null,
      price: null,
      route_id: null,
    })
    .mockResolvedValueOnce({
      city_id: 'damascus',
      geojson: {
        features: [{
          geometry: {
            coordinates: [[36.4, 33.5], [36.5, 33.6]],
            type: 'LineString',
          },
          properties: {},
          type: 'Feature',
        }],
        type: 'FeatureCollection',
      },
      id: 42,
      name_ar: 'مسودة الحساب الثاني',
      name_en: null,
      notes: null,
      price: null,
      route_id: null,
    });

  const view = await render(<TransitStudioScreen />, { wrapper: Providers });
  await waitFor(() =>
    expect(view.getByText('مسودة الحساب الأول')).toBeTruthy(),
  );

  mockUserId = 8;
  await view.rerender(<TransitStudioScreen />);

  expect(view.queryByText('مسودة الحساب الأول')).toBeNull();
  await waitFor(() =>
    expect(view.getByText('مسودة الحساب الثاني')).toBeTruthy(),
  );
  expect(getTransitStudioDraft).toHaveBeenCalledTimes(2);

  await fireEvent.press(view.getByText('حفظ التعديلات'));
  await waitFor(() =>
    expect(saveRouteDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({
        draftId: 42,
        nameAr: 'مسودة الحساب الثاني',
      }),
    ),
  );
});

test('clears and reloads a published edit when its route changes', async () => {
  mockEditParam = 'route-damascus-a';
  jest.mocked(getPublishedRouteForEdit)
    .mockResolvedValueOnce({
      city_id: 'damascus',
      geojson: {
        features: [{
          geometry: {
            coordinates: [[36.2, 33.4], [36.3, 33.5]],
            type: 'LineString',
          },
          properties: {},
          type: 'Feature',
        }],
        type: 'FeatureCollection',
      },
      id: 'route-damascus-a',
      is_published_route: true,
      name_ar: 'الخط الأول',
      name_en: null,
      notes: null,
      price: null,
      route_id: 'route-damascus-a',
    })
    .mockResolvedValueOnce({
      city_id: 'damascus',
      geojson: {
        features: [{
          geometry: {
            coordinates: [[36.4, 33.5], [36.5, 33.6]],
            type: 'LineString',
          },
          properties: {},
          type: 'Feature',
        }],
        type: 'FeatureCollection',
      },
      id: 'route-damascus-b',
      is_published_route: true,
      name_ar: 'الخط الثاني',
      name_en: null,
      notes: null,
      price: null,
      route_id: 'route-damascus-b',
    });

  const view = await render(<TransitStudioScreen />, { wrapper: Providers });
  await waitFor(() => expect(view.getByText('الخط الأول')).toBeTruthy());

  mockEditParam = 'route-damascus-b';
  await view.rerender(<TransitStudioScreen />);

  expect(view.queryByText('الخط الأول')).toBeNull();
  await waitFor(() => expect(view.getByText('الخط الثاني')).toBeTruthy());
  expect(getPublishedRouteForEdit).toHaveBeenNthCalledWith(
    2,
    'route-damascus-b',
  );

  await fireEvent.press(view.getByText('حفظ التعديلات'));
  await waitFor(() =>
    expect(saveRouteDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nameAr: 'الخط الثاني',
        routeId: 'route-damascus-b',
      }),
    ),
  );
});
