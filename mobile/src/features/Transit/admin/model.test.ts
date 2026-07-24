import type { TransitDraft } from '../api';
import {
  buildDraftMapData,
  buildPublishedRouteMapData,
  filterTransitDrafts,
  TRANSIT_ADMIN_PERMISSIONS,
  transitAdminAccess,
  transitAdminDraftsQueryKey,
  transitDraftStats,
  transitDraftStopCount,
} from './model';

function draft(overrides: Partial<TransitDraft> = {}): TransitDraft {
  return {
    city: { name_ar: 'دمشق', name_en: 'Damascus' },
    city_id: 'damascus',
    created_at: '2026-07-15T10:00:00Z',
    geojson: {
      features: [
        {
          geometry: {
            coordinates: [[36.2, 33.4], [36.3, 33.5]],
            type: 'LineString',
          },
          properties: {},
          type: 'Feature',
        },
        {
          geometry: { coordinates: [36.3, 33.5], type: 'Point' },
          properties: { nameAr: 'البرامكة' },
          type: 'Feature',
        },
      ],
      type: 'FeatureCollection',
    },
    id: 1,
    name_ar: 'خط تجريبي',
    name_en: 'Test route',
    notes: null,
    price: 3_000,
    rejection_reason: null,
    status: 'pending',
    user: { id: 5, is_banned: false, name: 'مساهم' },
    user_id: 5,
    ...overrides,
  };
}

describe('transit admin model', () => {
  test('scopes privileged draft cache entries to the signed-in account', () => {
    expect(transitAdminDraftsQueryKey(42)).toEqual([
      'transit-admin-drafts',
      42,
    ]);
  });

  test.each(Object.entries(TRANSIT_ADMIN_PERMISSIONS))(
    'grants an ordinary account only the %s transit capability',
    (capability, permission) => {
      const access = transitAdminAccess({
        is_banned: false,
        permissions: [permission],
        role: 'user',
      });

      expect(access.canAccess).toBe(true);
      for (const current of Object.keys(TRANSIT_ADMIN_PERMISSIONS)) {
        expect(access[current as keyof typeof TRANSIT_ADMIN_PERMISSIONS]).toBe(
          current === capability,
        );
      }
    },
  );

  test.each(['admin', 'superadmin', 'transit_admin'])(
    'preserves full transit access for the %s role',
    (role) => {
      const access = transitAdminAccess({
        is_banned: false,
        permissions: [],
        role,
      });

      expect(access.canAccess).toBe(true);
      for (const capability of Object.keys(TRANSIT_ADMIN_PERMISSIONS)) {
        expect(
          access[capability as keyof typeof TRANSIT_ADMIN_PERMISSIONS],
        ).toBe(true);
      }
    },
  );

  test('preserves wildcard access and rejects ordinary or banned accounts', () => {
    expect(
      transitAdminAccess({
        is_banned: false,
        permissions: ['*'],
        role: 'user',
      }).canAccess,
    ).toBe(true);
    expect(
      transitAdminAccess({
        is_banned: false,
        permissions: [],
        role: 'user',
      }).canAccess,
    ).toBe(false);
    expect(
      transitAdminAccess({
        is_banned: true,
        permissions: ['*'],
        role: 'user',
      }).canAccess,
    ).toBe(false);
  });

  test('counts, filters, and sorts route drafts', () => {
    const drafts = [
      draft({ id: 1, status: 'approved' }),
      draft({ city_id: 'hama', created_at: '2026-07-16T10:00:00Z', id: 2 }),
      draft({ id: 3, status: 'rejected' }),
    ];
    expect(transitDraftStats(drafts)).toEqual({ approved: 1, pending: 1, rejected: 1 });
    expect(filterTransitDrafts(drafts, 'pending', 'hama').map((item) => item.id)).toEqual([2]);
  });

  test('builds a bounded native map preview and ignores invalid coordinates', () => {
    const value = draft();
    expect(transitDraftStopCount(value)).toBe(1);
    const data = buildDraftMapData(value, undefined, 6);
    expect(data.routes.features[0]?.geometry.coordinates).toEqual([[36.2, 33.4], [36.3, 33.5]]);
    expect(data.routes.features[0]?.properties.colorIndex).toBe(6);
    expect(data.stops.features[0]?.properties.nameAr).toBe('البرامكة');

    const invalid = draft({
      geojson: JSON.stringify({
        features: [{ geometry: { coordinates: [999, 999], type: 'Point' } }],
      }),
    });
    expect(transitDraftStopCount(invalid)).toBe(0);
    expect(buildDraftMapData(invalid).stops.features).toEqual([]);
  });

  test('builds a native preview for a published route GeoJSON response', () => {
    const data = buildPublishedRouteMapData(
      {
        city: { name_ar: 'دمشق', name_en: 'Damascus' },
        city_id: 'damascus',
        color_index: 5,
        created_at: '2026-07-24T10:00:00Z',
        id: 'route-a',
        name_ar: 'خط منشور',
        name_en: 'Published route',
        price_new: 2_500,
        price_old: null,
        status: 'published',
        stops_count: 1,
      },
      {
        features: [
          {
            geometry: {
              coordinates: [[36.2, 33.4], [36.3, 33.5]],
              type: 'LineString',
            },
            properties: {},
            type: 'Feature',
          },
          {
            geometry: { coordinates: [36.25, 33.45], type: 'Point' },
            properties: { id: 'stop-a', nameAr: 'الموقف' },
            type: 'Feature',
          },
        ],
        type: 'FeatureCollection',
      },
    );

    expect(data.routes.features[0]?.properties.id).toBe('route-a');
    expect(data.routes.features[0]?.properties.colorIndex).toBe(5);
    expect(data.stops.features[0]?.properties.nameAr).toBe('الموقف');
  });
});
