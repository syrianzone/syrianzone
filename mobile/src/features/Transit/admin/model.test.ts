import type { TransitDraft } from '../api';
import {
  buildDraftMapData,
  canReviewTransit,
  filterTransitDrafts,
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

  test('enforces every source transit reviewer role', () => {
    expect(canReviewTransit('admin')).toBe(true);
    expect(canReviewTransit('transit_admin')).toBe(true);
    expect(canReviewTransit('superadmin')).toBe(true);
    expect(canReviewTransit('user')).toBe(false);
    expect(canReviewTransit(null)).toBe(false);
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
    const data = buildDraftMapData(value);
    expect(data.routes.features[0]?.geometry.coordinates).toEqual([[36.2, 33.4], [36.3, 33.5]]);
    expect(data.stops.features[0]?.properties.nameAr).toBe('البرامكة');

    const invalid = draft({
      geojson: JSON.stringify({
        features: [{ geometry: { coordinates: [999, 999], type: 'Point' } }],
      }),
    });
    expect(transitDraftStopCount(invalid)).toBe(0);
    expect(buildDraftMapData(invalid).stops.features).toEqual([]);
  });
});
