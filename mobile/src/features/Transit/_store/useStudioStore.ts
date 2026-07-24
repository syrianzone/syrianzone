import { create } from 'zustand';

export interface StopFeature {
  coordinates: [number, number];
  id: number;
  nameAr: string;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface StudioDraftData {
  city_id: string;
  geojson: unknown;
  id: number | string;
  is_published_route?: boolean;
  name_ar: string;
  name_en: string | null;
  notes: string | null;
  price: number | null;
  route_id?: string | null;
}

interface StudioState {
  addStop: (coordinate: [number, number]) => void;
  beginNewDraft: (
    accountId: number | null,
    dismissedEditTarget: string | null,
  ) => void;
  cityId: string;
  clearDismissedEditTarget: () => void;
  dismissedEditTarget: string | null;
  drawnLine: [number, number][] | null;
  editAccountId: number | null;
  editLoadFailed: boolean;
  editingDraftId: number | null;
  editingRouteId: string | null;
  editTarget: string | null;
  insertVertex: (index: number, coordinate: [number, number]) => void;
  isEditMode: boolean;
  loadDraft: (draft: StudioDraftData) => void;
  nameAr: string;
  nameEn: string;
  notes: string;
  price: string;
  removeVertex: (index: number) => void;
  removeStop: (id: number) => void;
  reset: () => void;
  setCity: (id: string) => void;
  setDrawnLine: (coordinates: [number, number][] | null) => void;
  setEditMode: (draftId: number | null, routeId?: string | null) => void;
  setEditLoadFailed: (failed: boolean) => void;
  setMeta: (
    fields: Partial<Pick<StudioState, 'nameAr' | 'nameEn' | 'notes' | 'price'>>,
  ) => void;
  setStep: (step: WizardStep) => void;
  setSubmittedDraftId: (id: number | null) => void;
  step: WizardStep;
  stops: StopFeature[];
  submittedDraftId: number | null;
  switchEditContext: (
    accountId: number | null,
    editTarget: string | null,
  ) => void;
  updateStopName: (id: number, nameAr: string) => void;
  updateVertex: (index: number, coordinate: [number, number]) => void;
}

const initialState = {
  cityId: '',
  dismissedEditTarget: null,
  drawnLine: null,
  editAccountId: null,
  editLoadFailed: false,
  editingDraftId: null,
  editingRouteId: null,
  editTarget: null,
  isEditMode: false,
  nameAr: '',
  nameEn: '',
  notes: '',
  price: '',
  step: 1 as WizardStep,
  stops: [],
  submittedDraftId: null,
};

function readFeatureCollection(
  value: unknown,
): readonly Record<string, unknown>[] {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!parsed || typeof parsed !== 'object' || !('features' in parsed)) {
    return [];
  }
  const features = (parsed as { features?: unknown }).features;
  return Array.isArray(features)
    ? features.filter(
        (feature): feature is Record<string, unknown> =>
          typeof feature === 'object' && feature !== null,
      )
    : [];
}

function readCoordinate(value: unknown): [number, number] | null {
  return Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
    ? [value[0], value[1]]
    : null;
}

function readGeometry(feature: Record<string, unknown>): Record<string, unknown> | null {
  return typeof feature.geometry === 'object' && feature.geometry !== null
    ? feature.geometry as Record<string, unknown>
    : null;
}

export const useStudioStore = create<StudioState>((set) => ({
  ...initialState,
  addStop: (coordinates) =>
    set((state) => ({
      stops: [
        ...state.stops,
        { coordinates, id: Date.now(), nameAr: '' },
      ],
    })),
  beginNewDraft: (editAccountId, dismissedEditTarget) =>
    set({
      ...initialState,
      dismissedEditTarget,
      editAccountId,
    }),
  clearDismissedEditTarget: () => set({ dismissedEditTarget: null }),
  removeStop: (id) =>
    set((state) => ({ stops: state.stops.filter((stop) => stop.id !== id) })),
  insertVertex: (index, coordinate) =>
    set((state) => {
      const next = [...(state.drawnLine ?? [])];
      next.splice(Math.max(0, Math.min(index, next.length)), 0, coordinate);
      return { drawnLine: next };
    }),
  loadDraft: (draft) => {
    let drawnLine: [number, number][] | null = null;
    const stops: StopFeature[] = [];
    for (const feature of readFeatureCollection(draft.geojson)) {
      const geometry = readGeometry(feature);
      if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) {
        const coordinates = geometry.coordinates.map(readCoordinate);
        if (coordinates.length >= 2 && coordinates.every((item) => item !== null)) {
          drawnLine = coordinates as [number, number][];
        }
      } else if (geometry?.type === 'Point') {
        const coordinates = readCoordinate(geometry.coordinates);
        const properties = typeof feature.properties === 'object' && feature.properties !== null
          ? feature.properties as Record<string, unknown>
          : null;
        if (coordinates) {
          stops.push({
            coordinates,
            id: Date.now() + stops.length,
            nameAr: typeof properties?.nameAr === 'string' ? properties.nameAr : '',
          });
        }
      }
    }
    const published = draft.is_published_route === true;
    set({
      cityId: draft.city_id,
      drawnLine,
      editingDraftId:
        published || typeof draft.id !== 'number' ? null : draft.id,
      editingRouteId: published ? draft.route_id ?? String(draft.id) : null,
      isEditMode: true,
      nameAr: draft.name_ar,
      nameEn: draft.name_en ?? '',
      notes: draft.notes ?? '',
      price: draft.price === null ? '' : String(draft.price),
      step: 5,
      stops,
      submittedDraftId: null,
    });
  },
  removeVertex: (index) =>
    set((state) => {
      if (!state.drawnLine || state.drawnLine.length <= 2) {
        return {};
      }
      return {
        drawnLine: state.drawnLine.filter((_, vertexIndex) => vertexIndex !== index),
      };
    }),
  reset: () => set(initialState),
  setCity: (cityId) => set({ cityId }),
  setDrawnLine: (drawnLine) => set({ drawnLine }),
  setEditMode: (editingDraftId, editingRouteId = null) =>
    set({
      editingDraftId,
      editingRouteId,
      isEditMode: editingDraftId !== null || editingRouteId !== null,
    }),
  setEditLoadFailed: (editLoadFailed) => set({ editLoadFailed }),
  setMeta: (fields) => set(fields),
  setStep: (step) => set({ step }),
  setSubmittedDraftId: (submittedDraftId) => set({ submittedDraftId }),
  switchEditContext: (editAccountId, editTarget) =>
    set((state) =>
      state.editAccountId === editAccountId && state.editTarget === editTarget
        ? {}
        : { ...initialState, editAccountId, editTarget },
    ),
  updateStopName: (id, nameAr) =>
    set((state) => ({
      stops: state.stops.map((stop) =>
        stop.id === id ? { ...stop, nameAr } : stop,
      ),
    })),
  updateVertex: (index, coordinate) =>
    set((state) => ({
      drawnLine: state.drawnLine?.map((vertex, vertexIndex) =>
        vertexIndex === index ? coordinate : vertex,
      ) ?? null,
    })),
}));

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_store/useStudioStore.ts (105 lines)
  confidence: high
  todos:      0
  notes:      Five-step state, draft hydration, edit targets, stops, and route vertices remain platform independent.
*/
