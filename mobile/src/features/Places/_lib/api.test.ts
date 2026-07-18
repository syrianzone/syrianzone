import { apiClient, type ApiRequestOptions } from '@/lib/api/client';
import { apiOrigin } from '@/lib/env';

import {
  guideSchema,
  placeCategorySchema,
  placeListItemSchema,
  placesApi,
} from './api';

const place = {
  category: 'historical',
  description: 'مكان تاريخي في سوريا',
  id: 1,
  lat: 33.5,
  lng: 36.3,
  name: 'مكان',
  saves_count: 1,
  thumb_url: null,
} as const;

describe('Places API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('rejects malformed save counters and geographic coordinates', () => {
    expect(placeListItemSchema.safeParse(place).success).toBe(true);
    expect(
      placeListItemSchema.safeParse({ ...place, saves_count: -1 }).success,
    ).toBe(false);
    expect(placeListItemSchema.safeParse({ ...place, lat: 100 }).success).toBe(
      false,
    );
  });

  test('accepts the current food category and validates guide metrics', () => {
    expect(placeCategorySchema.parse('food')).toBe('food');
    expect(
      guideSchema.safeParse({
        approved_count: 3,
        avatar_url: null,
        name: 'ليلى',
        rank: 1,
        recent_count: 2,
        saves_total: 9,
        user_id: 4,
      }).success,
    ).toBe(true);
    expect(
      guideSchema.safeParse({
        approved_count: -1,
        avatar_url: null,
        name: 'ليلى',
        rank: 1,
        recent_count: 2,
        saves_total: 9,
        user_id: 4,
      }).success,
    ).toBe(false);
  });

  test('normalizes local media paths and rejects protocol-relative media', () => {
    expect(
      placeListItemSchema.parse({ ...place, thumb_url: '/storage/place.webp' })
        .thumb_url,
    ).toBe(`${apiOrigin}/storage/place.webp`);
    expect(
      placeListItemSchema.safeParse({
        ...place,
        thumb_url: '//attacker.example/place.webp',
      }).success,
    ).toBe(false);
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

  test('validates public Google suggestions, guides, and gallery pages', async () => {
    const calls: { auth: boolean | undefined; path: string; query: unknown }[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({ auth: options.auth, path, query: options.query });
        const value = path.endsWith('/geocode')
          ? {
              suggestions: [{
                address: 'دمشق، سوريا',
                lat: 33.5112,
                lng: 36.3037,
                name: 'سوق الحميدية',
              }],
            }
          : path.endsWith('/guides')
            ? {
                guides: [{
                  approved_count: 2,
                  avatar_url: null,
                  name: 'ليلى',
                  rank: 1,
                  recent_count: 1,
                  saves_total: 7,
                  user_id: 5,
                }],
                sort: 'saves',
              }
            : {
                current_page: 1,
                data: [{
                  display_url: 'https://cdn.example.test/display.webp',
                  id: 8,
                  place: {
                    category: 'food',
                    id: 3,
                    lat: 33.5,
                    lng: 36.3,
                    name: 'مطبخ دمشقي',
                  },
                  thumb_url: 'https://cdn.example.test/thumb.webp',
                }],
                last_page: 1,
                total: 1,
              };
        return options.schema.parse(value);
      },
    );

    await expect(placesApi.geocode('الحميدية')).resolves.toEqual({
      suggestions: [{
        address: 'دمشق، سوريا',
        lat: 33.5112,
        lng: 36.3037,
        name: 'سوق الحميدية',
      }],
    });
    await placesApi.guides('saves');
    await placesApi.gridPhotos(2);

    expect(calls).toEqual([
      { auth: false, path: '/api/v1/places/geocode', query: { q: 'الحميدية' } },
      { auth: false, path: '/api/v1/guides', query: { sort: 'saves' } },
      { auth: false, path: '/api/v1/places/photos', query: { page: 2 } },
    ]);
  });

  test('sends every owner management operation to its registered route', async () => {
    const calls: { body: unknown; method: string | undefined; path: string }[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({ body: options.body, method: options.method, path });
        const value = path.endsWith('/location')
          ? { id: 1, lat: 34, lng: 37, status: 'pending' }
          : path.endsWith('/photos')
            ? {
                display_url: 'https://cdn.example.test/display.webp',
                id: 9,
                place_status: 'pending',
                sort: 1,
                thumb_url: 'https://cdn.example.test/thumb.webp',
              }
            : path.includes('/place-photos/') && options.method === 'DELETE'
              ? { id: 9, place_status: 'pending' }
              : path.endsWith('/rotate')
                ? {
                    display_url: 'https://cdn.example.test/display.webp?v=2',
                    id: 9,
                    thumb_url: 'https://cdn.example.test/thumb.webp?v=2',
                  }
                : path.endsWith('/resubmit')
                  ? { id: 1, status: 'pending' }
                  : options.method === 'DELETE'
                    ? undefined
                    : {
                        category: 'food',
                        description: 'وصف جديد طويل بما يكفي',
                        id: 1,
                        name: 'اسم جديد',
                        status: 'pending',
                      };
        return options.schema.parse(value);
      },
    );
    const photo = {
      fileName: 'place.webp',
      fileSize: 1234,
      mimeType: 'image/webp',
      uri: 'file:///place.webp',
    };

    await placesApi.updateMyPlaceLocation(1, { lat: 34, lng: 37 });
    await placesApi.updateMyPlace(1, { category: 'food', name: 'اسم جديد' });
    await placesApi.addMyPhoto(1, photo);
    await placesApi.deleteMyPhoto(9);
    await placesApi.rotateMyPhoto(9);
    await placesApi.resubmitMyPlace(1);
    await placesApi.deleteMyPlace(1);

    expect(calls.map(({ method, path }) => ({ method, path }))).toEqual([
      { method: 'PATCH', path: '/api/v1/my/places/1/location' },
      { method: 'PATCH', path: '/api/v1/my/places/1' },
      { method: 'POST', path: '/api/v1/my/places/1/photos' },
      { method: 'DELETE', path: '/api/v1/my/place-photos/9' },
      { method: 'POST', path: '/api/v1/my/place-photos/9/rotate' },
      { method: 'POST', path: '/api/v1/my/places/1/resubmit' },
      { method: 'DELETE', path: '/api/v1/my/places/1' },
    ]);
    expect(calls[1]?.body).toEqual({ category: 'food', name: 'اسم جديد' });
    expect(calls[2]?.body).toBeInstanceOf(FormData);
  });

  test('sends every admin edit and photo operation to its registered route', async () => {
    const calls: { body: unknown; method: string | undefined; path: string }[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({ body: options.body, method: options.method, path });
        if (path.endsWith('/photos')) {
          return options.schema.parse({
            display_url: 'https://cdn.example.test/display.webp',
            id: 8,
            sort: 2,
            thumb_url: 'https://cdn.example.test/thumb.webp',
          });
        }
        if (path.endsWith('/rotate') || path.endsWith('/replace')) {
          return options.schema.parse({
            display_url: 'https://cdn.example.test/display.webp?v=2',
            id: 8,
            thumb_url: 'https://cdn.example.test/thumb.webp?v=2',
          });
        }
        if (options.method === 'DELETE') {
          return options.schema.parse(undefined);
        }
        return options.schema.parse({
          ...place,
          created_at: '2026-07-16T10:00:00Z',
          photos: [],
          rejection_reason: null,
          saved_by_me: false,
          status: 'approved',
          user: { avatar_url: null, id: 2, name: 'مساهم' },
        });
      },
    );
    const photo = {
      fileName: 'place.webp',
      fileSize: 1234,
      mimeType: 'image/webp',
      uri: 'file:///place.webp',
    };

    await placesApi.adminUpdatePlace(1, { name: 'اسم معدل' });
    await placesApi.adminAddPhoto(1, photo);
    await placesApi.adminRotatePhoto(8);
    await placesApi.adminReplacePhoto(8, photo);
    await placesApi.adminDeletePhoto(8);

    expect(calls.map(({ method, path }) => ({ method, path }))).toEqual([
      { method: 'PATCH', path: '/api/v1/admin/places/1' },
      { method: 'POST', path: '/api/v1/admin/places/1/photos' },
      { method: 'POST', path: '/api/v1/admin/place-photos/8/rotate' },
      { method: 'POST', path: '/api/v1/admin/place-photos/8/replace' },
      { method: 'DELETE', path: '/api/v1/admin/place-photos/8' },
    ]);
    expect(calls[0]?.body).toEqual({ name: 'اسم معدل' });
    expect(calls[1]?.body).toBeInstanceOf(FormData);
    expect(calls[3]?.body).toBeInstanceOf(FormData);
  });
});
