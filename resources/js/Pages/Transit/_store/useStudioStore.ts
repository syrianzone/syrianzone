import { create } from 'zustand'
import { normalizeFeatureCollection, normalizePosition } from '@/Components/map/geo'
import type { StudioDraftPayload } from '../_types/admin'

export interface StopFeature {
  id: number
  coordinates: [number, number]
  nameAr: string
}

export type WizardStep = 1 | 2 | 3 | 4 | 5

export interface StudioState {
  step: WizardStep
  cityId: string
  drawnLine: [number, number][] | null
  stops: StopFeature[]
  nameAr: string
  nameEn: string
  price: string
  notes: string
  colorIndex: number
  submittedDraftId: number | null

  // Edit mode
  editingDraftId: number | null
  editingRouteId: string | null
  isEditMode: boolean

  setStep: (s: WizardStep) => void
  setCity: (id: string) => void
  setDrawnLine: (coords: [number, number][] | null) => void
  addStop: (coord: [number, number]) => void
  updateStopName: (id: number, nameAr: string) => void
  updateStopCoordinates: (id: number, coords: [number, number]) => void
  removeStop: (id: number) => void
  setMeta: (fields: Partial<Pick<StudioState, 'nameAr' | 'nameEn' | 'price' | 'notes' | 'colorIndex'>>) => void
  setColorIndex: (idx: number) => void
  setSubmittedDraftId: (id: number | null) => void
  setEditMode: (draftId: number | null, routeId?: string | null) => void
  loadDraft: (draft: StudioDraftPayload) => void
  reset: () => void
}

/** A partial restore, e.g. the session stashed before a login redirect. */
export type StudioPatch = Partial<Omit<StudioState, 'setStep' | 'setCity' | 'setDrawnLine' | 'addStop' | 'updateStopName' | 'updateStopCoordinates' | 'removeStop' | 'setMeta' | 'setColorIndex' | 'setSubmittedDraftId' | 'setEditMode' | 'loadDraft' | 'reset'>>

type StudioStateFields = Omit<StudioState, 'setStep' | 'setCity' | 'setDrawnLine' | 'addStop' | 'updateStopName' | 'updateStopCoordinates' | 'removeStop' | 'setMeta' | 'setColorIndex' | 'setSubmittedDraftId' | 'setEditMode' | 'loadDraft' | 'reset'>

const initialState: StudioStateFields = {
  step: 1,
  cityId: '',
  drawnLine: null,
  stops: [],
  nameAr: '',
  nameEn: '',
  price: '',
  notes: '',
  colorIndex: 0,
  submittedDraftId: null,
  editingDraftId: null,
  editingRouteId: null,
  isEditMode: false,
}

export const useStudioStore = create<StudioState>((set) => ({
  ...initialState,

  setStep: (s) => set({ step: s }),
  setCity: (id) => set({ cityId: id }),
  setDrawnLine: (coords) => set({ drawnLine: coords }),
  addStop: (coord) =>
    set((state) => ({
      stops: [...state.stops, { id: Date.now(), coordinates: coord, nameAr: '' }],
    })),
  updateStopName: (id, nameAr) =>
    set((state) => ({
      stops: state.stops.map((s) => (s.id === id ? { ...s, nameAr } : s)),
    })),
  updateStopCoordinates: (id, coords) =>
    set((state) => ({
      stops: state.stops.map((s) => (s.id === id ? { ...s, coordinates: coords } : s)),
    })),
  removeStop: (id) =>
    set((state) => ({ stops: state.stops.filter((s) => s.id !== id) })),
  setMeta: (fields) => set(fields),
  setColorIndex: (colorIndex) => set({ colorIndex }),
  setSubmittedDraftId: (id) => set({ submittedDraftId: id }),
  setEditMode: (draftId, routeId) =>
    set({ editingDraftId: draftId, editingRouteId: routeId ?? null, isEditMode: draftId !== null || routeId !== null }),
  loadDraft: (draft) => {
    const geojson = normalizeFeatureCollection(draft.geojson)
    let drawnLine: [number, number][] | null = null
    const stops: StopFeature[] = []
    let extractedColorIndex = draft.color_index ?? draft.colorIndex ?? 0

    for (const feature of geojson.features) {
      const properties = feature.properties
      const fromProperties = properties?.colorIndex ?? properties?.color_index
      if (fromProperties !== undefined) extractedColorIndex = Number(fromProperties)

      if (feature.geometry.type === 'LineString') {
        const coordinates = feature.geometry.coordinates
          .map((position) => normalizePosition(position))
          .filter((position): position is [number, number] => position !== null)
        if (coordinates.length > 0) drawnLine = coordinates
      } else if (feature.geometry.type === 'Point') {
        const coordinates = normalizePosition(feature.geometry.coordinates)
        if (coordinates) {
          stops.push({
            id: Date.now() + stops.length,
            coordinates,
            nameAr: String(properties?.nameAr ?? ''),
          })
        }
      }
    }

    const isPublishedRoute = !!draft.is_published_route
    set({
      cityId: draft.city_id ?? '',
      drawnLine,
      stops,
      nameAr: draft.name_ar ?? '',
      nameEn: draft.name_en ?? '',
      price: draft.price != null ? String(draft.price) : '',
      notes: draft.notes ?? '',
      colorIndex: Number(extractedColorIndex) || 0,
      step: 5,
      editingDraftId: isPublishedRoute ? null : (draft.id ?? null),
      editingRouteId: isPublishedRoute ? draft.route_id ?? null : null,
      isEditMode: true,
    })
  },
  reset: () => set(initialState),
}))
