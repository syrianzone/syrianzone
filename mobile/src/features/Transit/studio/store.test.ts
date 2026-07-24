import { useStudioStore } from '../_store/useStudioStore';

describe('transit studio stops', () => {
  beforeEach(() => {
    useStudioStore.getState().reset();
  });

  test('adds, names, and removes authored stops', () => {
    const store = useStudioStore.getState();
    store.addStop([36.2, 33.4]);

    const stop = useStudioStore.getState().stops[0];
    expect(stop?.coordinates).toEqual([36.2, 33.4]);

    if (!stop) {
      throw new Error('Expected an authored stop');
    }

    useStudioStore.getState().updateStopName(stop.id, 'البرامكة');
    expect(useStudioStore.getState().stops[0]?.nameAr).toBe('البرامكة');

    useStudioStore.getState().removeStop(stop.id);
    expect(useStudioStore.getState().stops).toEqual([]);
  });

  test('hydrates an owned draft and preserves its edit target', () => {
    useStudioStore.getState().loadDraft({
      city_id: 'hama',
      geojson: {
        features: [
          {
            geometry: {
              coordinates: [[36.7, 35.1], [36.8, 35.2]],
              type: 'LineString',
            },
            properties: { type: 'route' },
            type: 'Feature',
          },
          {
            geometry: { coordinates: [36.75, 35.15], type: 'Point' },
            properties: { nameAr: 'المحطة' },
            type: 'Feature',
          },
        ],
        type: 'FeatureCollection',
      },
      id: 42,
      name_ar: 'خط حماة',
      name_en: 'Hama route',
      notes: 'ملاحظة',
      price: 4_000,
      route_id: null,
    });

    expect(useStudioStore.getState()).toMatchObject({
      cityId: 'hama',
      drawnLine: [[36.7, 35.1], [36.8, 35.2]],
      editingDraftId: 42,
      editingRouteId: null,
      isEditMode: true,
      nameAr: 'خط حماة',
      nameEn: 'Hama route',
      notes: 'ملاحظة',
      price: '4000',
      step: 5,
      stops: [expect.objectContaining({
        coordinates: [36.75, 35.15],
        nameAr: 'المحطة',
      })],
    });
  });

  test('hydrates a published route as a linked edit', () => {
    useStudioStore.getState().loadDraft({
      city_id: 'damascus',
      geojson: JSON.stringify({
        features: [{
          geometry: {
            coordinates: [[36.2, 33.4], [36.3, 33.5]],
            type: 'LineString',
          },
          properties: {},
          type: 'Feature',
        }],
        type: 'FeatureCollection',
      }),
      id: 'route-a',
      is_published_route: true,
      name_ar: 'خط منشور',
      name_en: null,
      notes: null,
      price: null,
      route_id: 'route-a',
    });

    expect(useStudioStore.getState()).toMatchObject({
      editingDraftId: null,
      editingRouteId: 'route-a',
      isEditMode: true,
      step: 5,
    });
  });

  test('never treats a published route ID as an owned draft ID', () => {
    useStudioStore.getState().loadDraft({
      city_id: 'damascus',
      geojson: {
        features: [],
        type: 'FeatureCollection',
      },
      id: 42,
      is_published_route: true,
      name_ar: 'خط منشور',
      name_en: null,
      notes: null,
      price: null,
      route_id: 'route-42',
    });

    expect(useStudioStore.getState()).toMatchObject({
      editingDraftId: null,
      editingRouteId: 'route-42',
      isEditMode: true,
    });
  });

  test('clears draft content and edit targets when the edit context changes', () => {
    useStudioStore.getState().switchEditContext(7, '42');
    useStudioStore.getState().loadDraft({
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
    });

    useStudioStore.getState().setEditLoadFailed(true);
    useStudioStore.getState().switchEditContext(8, '42');

    expect(useStudioStore.getState()).toMatchObject({
      cityId: '',
      drawnLine: null,
      editAccountId: 8,
      editLoadFailed: false,
      editingDraftId: null,
      editingRouteId: null,
      editTarget: '42',
      isEditMode: false,
      nameAr: '',
      step: 1,
    });
  });

  test('preserves draft content when the edit context is unchanged', () => {
    useStudioStore.getState().switchEditContext(7, 'route-a');
    useStudioStore.getState().setMeta({ nameAr: 'تعديل محفوظ محلياً' });

    useStudioStore.getState().switchEditContext(7, 'route-a');

    expect(useStudioStore.getState().nameAr).toBe('تعديل محفوظ محلياً');
  });

  test('begins a clean draft while an old edit link is leaving the route', () => {
    useStudioStore.getState().switchEditContext(7, '42');
    useStudioStore.getState().setMeta({ nameAr: 'مسودة قديمة' });

    useStudioStore.getState().beginNewDraft(7, '42');

    expect(useStudioStore.getState()).toMatchObject({
      dismissedEditTarget: '42',
      editAccountId: 7,
      editingDraftId: null,
      editingRouteId: null,
      editTarget: null,
      isEditMode: false,
      nameAr: '',
      step: 1,
    });
  });

  test('inserts, drags, and removes route vertices without deleting the final segment', () => {
    const store = useStudioStore.getState();
    store.setDrawnLine([[36.2, 33.4], [36.4, 33.6]]);
    store.insertVertex(1, [36.3, 33.5]);
    expect(useStudioStore.getState().drawnLine).toEqual([
      [36.2, 33.4],
      [36.3, 33.5],
      [36.4, 33.6],
    ]);

    useStudioStore.getState().updateVertex(1, [36.31, 33.51]);
    expect(useStudioStore.getState().drawnLine?.[1]).toEqual([36.31, 33.51]);

    useStudioStore.getState().removeVertex(1);
    expect(useStudioStore.getState().drawnLine).toEqual([
      [36.2, 33.4],
      [36.4, 33.6],
    ]);
    useStudioStore.getState().removeVertex(0);
    expect(useStudioStore.getState().drawnLine).toEqual([
      [36.2, 33.4],
      [36.4, 33.6],
    ]);
  });
});
