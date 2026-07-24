import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

import { placesApi } from '../_lib/api';
import type { MyPlace } from '../_lib/types';
import { PlacesPanel } from './PlacesPanel';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../_lib/api', () => ({
  placesApi: {
    myPlaces: jest.fn(),
    mySaves: jest.fn(),
    resubmitMyPlace: jest.fn(),
  },
}));
jest.mock('./PlaceCard', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    PlaceCard: ({ onPress, place }: { onPress: (id: number) => void; place: MyPlace }) => (
      <Pressable onPress={() => onPress(place.id)}><Text>{place.name}</Text></Pressable>
    ),
  };
});
jest.mock('./ManagePlaceDialog', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { ManagePlaceDialog: ({ place }: { place: MyPlace }) => <Text>إدارة {place.name}</Text> };
});
jest.mock('./GuidesTab', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    GuidesTab: ({ onSelectGuide }: { onSelectGuide: (guide: { id: number; name: string }) => void }) => (
      <Pressable onPress={() => onSelectGuide({ id: 5, name: 'ليلى' })}>
        <Text>المرشدون المحليون</Text>
      </Pressable>
    ),
  };
});

const rejected: MyPlace = {
  category: 'natural',
  created_at: '2026-07-18T10:00:00Z',
  description: 'وصف واضح لمكان طبيعي يستحق الزيارة.',
  id: 22,
  lat: 35.5,
  lng: 35.8,
  name: 'غابة الفرلق',
  rejection_reason: 'أضف صورة أوضح',
  saves_count: 1,
  status: 'rejected',
  thumb_url: null,
};

async function renderPanel(onMutated = jest.fn(async () => undefined), onSelectGuide = jest.fn()) {
  const view = await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } })}>
      <LocaleProvider>
        <AppThemeProvider>
          <PlacesPanel
            hasMore={false}
            loading={false}
            onLoadMore={jest.fn()}
            onMutated={onMutated}
            onSelect={jest.fn()}
            onSelectGuide={onSelectGuide}
            places={[]}
            selectedId={null}
          />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
  return { onMutated, onSelectGuide, view };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    clearError: jest.fn(),
    error: null,
    isAdmin: false,
    isSuperAdmin: false,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    user: { avatar_url: null, email: 'member@example.test', id: 9, is_banned: false, name: 'عضو', role: 'user' },
  });
  jest.mocked(placesApi.myPlaces).mockResolvedValue({
    current_page: 1,
    data: [rejected],
    last_page: 1,
    total: 1,
  });
  jest.mocked(placesApi.mySaves).mockResolvedValue({ current_page: 1, data: [], last_page: 1, total: 0 });
  jest.mocked(placesApi.resubmitMyPlace).mockResolvedValue({ id: rejected.id, status: 'pending' });
});

test('lets owners manage and resubmit rejected contributions', async () => {
  const { onMutated, view } = await renderPanel();

  await fireEvent.press(view.getByText('مساهماتي'));
  await waitFor(() => expect(view.getByText(rejected.name)).toBeTruthy());
  expect(view.getByText(rejected.rejection_reason!)).toBeTruthy();
  await act(async () => {
    fireEvent.press(view.getByText('إعادة إرسال'));
  });

  await waitFor(() => expect(placesApi.resubmitMyPlace).toHaveBeenCalledWith(rejected.id));
  expect(onMutated).toHaveBeenCalledTimes(1);
  await fireEvent.press(view.getByText('إدارة'));
  expect(view.getByText(`إدارة ${rejected.name}`)).toBeTruthy();
});

test('keeps the public guides tab available to guests', async () => {
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
  const { view } = await renderPanel();

  expect(view.getByText('مرشدون')).toBeTruthy();
  await fireEvent.press(view.getByText('مرشدون'));
  expect(view.getByText('المرشدون المحليون')).toBeTruthy();
  expect(view.queryByText('محفوظاتي')).toBeNull();
  expect(view.queryByText('مساهماتي')).toBeNull();
});

test('returns to the places tab after choosing a guide filter', async () => {
  const { onSelectGuide, view } = await renderPanel();

  await fireEvent.press(view.getByText('مرشدون'));
  await fireEvent.press(view.getByText('المرشدون المحليون'));

  expect(onSelectGuide).toHaveBeenCalledWith({ id: 5, name: 'ليلى' });
  expect(view.getByText('لا توجد أماكن.')).toBeTruthy();
});
