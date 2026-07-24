import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

import { placesApi } from './_lib/api';
import { discovery } from './_lib/discovery';
import type { PlaceFeatureCollection } from './_lib/types';
import PlacesIndex from './Index';

let mockAuthUserId: number | null = null;

jest.mock('expo-router', () => ({
  router: { setParams: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('./_lib/api', () => ({
  placesApi: {
    geocode: jest.fn(),
    getPlace: jest.fn(),
    listPlaces: jest.fn(),
    mapData: jest.fn(),
  },
}));
jest.mock('./_lib/discovery', () => ({
  discovery: { guides: jest.fn() },
}));
jest.mock('@/components/ui/Screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('./_components/FilterBar', () => ({ FilterBar: () => null }));
jest.mock('./_components/ViewToggle', () => ({
  ViewToggle: () => null,
  placesViewFromParam: () => 'map',
}));
jest.mock('./_components/SubmitSheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SubmitSheet: () => {
      const [ownerId] = React.useState(mockAuthUserId);
      return <Text>مسودة الحساب {ownerId ?? 'زائر'}</Text>;
    },
  };
});
jest.mock('./_components/PhotoGrid', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PhotoGrid: React.forwardRef(
      function MockPhotoGrid(
        { guideId }: { guideId?: number },
        _ref: React.ForwardedRef<unknown>,
      ) {
        return (
          <Text>صور المرشد {guideId ?? 'الكل'}</Text>
        );
      },
    ),
  };
});
jest.mock('./_components/PlacesMap', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PlacesMap: ({
      data,
      onMapPress,
    }: {
      data: PlaceFeatureCollection;
      onMapPress: (point: { lat: number; lng: number }) => void;
    }) => (
      <Pressable
        accessibilityLabel="اختيار نقطة اختبار"
        onPress={() => onMapPress({ lat: 33.5, lng: 36.3 })}
      >
        <Text>دبابيس {data.features.map((item) => item.properties.id).join(',')}</Text>
      </Pressable>
    ),
  };
});
jest.mock('./_components/PlacesPanel', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PlacesPanel: () => {
      const [ownerId] = React.useState(mockAuthUserId);
      return (
        <Text>
          قائمة الأماكن للحساب {ownerId ?? 'زائر'}
        </Text>
      );
    },
  };
});

const mapData: PlaceFeatureCollection = {
  features: [
    {
      geometry: { coordinates: [36.3, 33.5], type: 'Point' },
      properties: { category: 'historical', id: 1, name: 'خان', thumb_url: null, user_id: 5 },
      type: 'Feature',
    },
    {
      geometry: { coordinates: [35.8, 35.5], type: 'Point' },
      properties: { category: 'natural', id: 2, name: 'غابة', thumb_url: null, user_id: 9 },
      type: 'Feature',
    },
  ],
  type: 'FeatureCollection',
};

beforeEach(() => {
  mockAuthUserId = null;
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({ guide: '5' });
  jest.mocked(useAuth).mockReturnValue({
    clearError: jest.fn(),
    error: null,
    isAdmin: false,
    isSuperAdmin: false,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    user: null,
  });
  jest.mocked(placesApi.mapData).mockResolvedValue(mapData);
  jest.mocked(placesApi.listPlaces).mockResolvedValue({
    current_page: 1,
    data: [],
    last_page: 1,
    total: 0,
  });
  jest.mocked(discovery.guides).mockResolvedValue({
    guides: [{
      approved_count: 4,
      avatar_url: null,
      level: 2,
      name: 'ليلى',
      points: 52,
      rank: 1,
      recent_count: 2,
      saves_total: 7,
      user_id: 5,
    }],
    sort: 'submissions',
  });
});

test('drives every discovery surface from the guide search parameter and clear chip', async () => {
  const view = await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } })}>
      <LocaleProvider>
        <AppThemeProvider>
          <PlacesIndex />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );

  await waitFor(() => expect(view.getByText('مساهمات ليلى')).toBeTruthy());
  expect(view.getByText('دبابيس 1')).toBeTruthy();
  expect(view.getByText('صور المرشد 5')).toBeTruthy();
  expect(placesApi.listPlaces).toHaveBeenCalledWith(expect.objectContaining({ user_id: 5 }));

  await fireEvent.press(view.getByLabelText('إلغاء التصفية'));

  expect(router.setParams).toHaveBeenCalledWith({ guide: undefined });
  await waitFor(() => expect(view.getByText('دبابيس 1,2')).toBeTruthy());
  expect(view.getByText('صور المرشد الكل')).toBeTruthy();
  expect(view.queryByText('مساهمات ليلى')).toBeNull();
  await waitFor(() => expect(placesApi.listPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ user_id: undefined })));
});

test('remounts private place state when the signed-in account changes', async () => {
  const account = (id: number) => ({
    avatar_url: null,
    email: `member-${id}@example.test`,
    id,
    is_banned: false,
    name: `عضو ${id}`,
    role: 'user',
  });
  mockAuthUserId = 9;
  jest.mocked(useAuth).mockReturnValue({
    clearError: jest.fn(),
    error: null,
    isAdmin: false,
    isSuperAdmin: false,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    user: account(9),
  });
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  const tree = () => (
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <AppThemeProvider>
          <PlacesIndex />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
  const view = await render(tree());

  expect(view.getByText('قائمة الأماكن للحساب 9')).toBeTruthy();
  await fireEvent.press(view.getByText('أضف مكاناً'));
  await fireEvent.press(view.getByLabelText('اختيار نقطة اختبار'));
  expect(view.getByText('مسودة الحساب 9')).toBeTruthy();

  mockAuthUserId = 10;
  jest.mocked(useAuth).mockReturnValue({
    clearError: jest.fn(),
    error: null,
    isAdmin: false,
    isSuperAdmin: false,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    user: account(10),
  });
  await view.rerender(tree());

  expect(view.getByText('قائمة الأماكن للحساب 10')).toBeTruthy();
  expect(view.getByText('مسودة الحساب 10')).toBeTruthy();
  expect(view.queryByText('قائمة الأماكن للحساب 9')).toBeNull();
  expect(view.queryByText('مسودة الحساب 9')).toBeNull();
});
