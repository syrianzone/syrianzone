import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { placesApi } from '../_lib/api';
import type { GridPhoto } from '../_lib/types';
import { PhotoGrid } from './PhotoGrid';
import { placesViewFromParam, ViewToggle } from './ViewToggle';

jest.mock('../_lib/api', () => ({
  placesApi: { gridPhotos: jest.fn() },
}));

const photos: GridPhoto[] = [
  {
    display_url: 'https://media.example/one.webp',
    id: 10,
    place: { category: 'food', id: 4, lat: 33.5, lng: 36.3, name: 'مطبخ دمشقي' },
    thumb_url: 'https://media.example/one-thumb.webp',
  },
  {
    display_url: 'https://media.example/two.webp',
    id: 11,
    place: { category: 'natural', id: 5, lat: 35.5, lng: 35.8, name: 'غابة الفرلق' },
    thumb_url: 'https://media.example/two-thumb.webp',
  },
];

function wrapper(children: React.ReactNode) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } })}>
      <LocaleProvider>
        <AppThemeProvider>{children}</AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(placesApi.gridPhotos).mockImplementation(async (page = 1) => ({
    current_page: page,
    data: page === 1 ? photos : [{ ...photos[0]!, id: 12 }],
    last_page: 2,
    total: 3,
  }));
});

test('loads the gallery only when active and opens a photo place', async () => {
  const onPhotoClick = jest.fn();
  const view = await render(wrapper(<PhotoGrid active={false} onPhotoClick={onPhotoClick} />));

  expect(placesApi.gridPhotos).not.toHaveBeenCalled();
  await view.rerender(wrapper(<PhotoGrid active onPhotoClick={onPhotoClick} />));
  await waitFor(() => expect(view.getByText('مطبخ دمشقي')).toBeTruthy());
  await fireEvent.press(view.getByText('غابة الفرلق'));

  expect(onPhotoClick).toHaveBeenCalledWith(photos[1]);
});

test('loads another gallery page without discarding the first page', async () => {
  const view = await render(wrapper(<PhotoGrid active onPhotoClick={jest.fn()} />));

  await waitFor(() => expect(view.getByText('عرض المزيد')).toBeTruthy());
  await act(async () => {
    fireEvent.press(view.getByText('عرض المزيد'));
  });

  await waitFor(() => expect(placesApi.gridPhotos).toHaveBeenLastCalledWith(2));
  await waitFor(() => expect(view.getAllByText('مطبخ دمشقي')).toHaveLength(2));
  expect(view.getByText('غابة الفرلق')).toBeTruthy();
});

test('switches between the map and gallery views', async () => {
  const onChange = jest.fn();
  const view = await render(wrapper(<ViewToggle onChange={onChange} view="map" />));

  await fireEvent.press(view.getByText('معرض'));
  expect(onChange).toHaveBeenCalledWith('grid');
  expect(view.getByText('خريطة')).toBeTruthy();
});

test('opens shared gallery links without accepting unknown view values', () => {
  expect(placesViewFromParam('grid')).toBe('grid');
  expect(placesViewFromParam(['grid', 'map'])).toBe('grid');
  expect(placesViewFromParam('photos')).toBe('map');
  expect(placesViewFromParam(undefined)).toBe('map');
});
