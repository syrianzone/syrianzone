import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import { placeListItemSchema, placesApi } from './api';

const place = {
  category: 'historical',
  comments_count: 0,
  description: 'مكان تاريخي في سوريا',
  id: 1,
  lat: 33.5,
  likes_count: 2,
  lng: 36.3,
  name: 'مكان',
  saves_count: 1,
  thumb_url: null,
} as const;

describe('Places API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('rejects malformed counters and geographic coordinates', () => {
    expect(placeListItemSchema.safeParse(place).success).toBe(true);
    expect(
      placeListItemSchema.safeParse({ ...place, likes_count: -1 }).success,
    ).toBe(false);
    expect(placeListItemSchema.safeParse({ ...place, lat: 100 }).success).toBe(
      false,
    );
  });

  test('keeps public lists anonymous and sends optional identity for detail reads', async () => {
    const calls: { auth: boolean | undefined; path: string }[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({ auth: options.auth, path });
        const value = path.endsWith('/1')
          ? {
              ...place,
              created_at: '2026-07-16T10:00:00Z',
              liked_by_me: false,
              photos: [],
              saved_by_me: false,
              status: 'approved',
              user: { avatar_url: null, id: 2, name: 'مساهم' },
            }
          : { current_page: 1, data: [place], last_page: 1, total: 1 };
        return options.schema.parse(value);
      },
    );

    await placesApi.listPlaces({ page: 1 });
    await placesApi.getPlace(1);

    expect(calls).toEqual([
      { auth: false, path: '/api/v1/places' },
      { auth: undefined, path: '/api/v1/places/1' },
    ]);
  });
});
