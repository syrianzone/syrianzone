import { create } from 'zustand'

export interface StopFeature {
  id: number
  coordinates: [number, number]
  nameAr: string
}

export type WizardStep = 1 | 2 | 3 | 4 | 5

interface StudioState {
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
  loadDraft: (draft: any) => void
  reset: () => void
}

const initialState = {
  step: 1 as WizardStep,
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
    const geojson = typeof draft.geojson === 'string' ? JSON.parse(draft.geojson) : draft.geojson
    let drawnLine: [number, number][] | null = null
    const stops: StopFeature[] = []
    let extractedColorIndex = draft.color_index ?? draft.colorIndex ?? 0
    for (const f of geojson?.features ?? []) {
      if (f.properties?.colorIndex !== undefined) extractedColorIndex = f.properties.colorIndex
      if (f.properties?.color_index !== undefined) extractedColorIndex = f.properties.color_index
      if (f.geometry?.type === 'LineString') {
        drawnLine = f.geometry.coordinates as [number, number][]
      } else if (f.geometry?.type === 'Point') {
        stops.push({
          id: Date.now() + stops.length,
          coordinates: f.geometry.coordinates as [number, number],
          nameAr: f.properties?.nameAr ?? '',
        })
      }
    }
    const isPublishedRoute = !!draft.is_published_route
    set({
      cityId: draft.city_id,
      drawnLine,
      stops,
      nameAr: draft.name_ar ?? '',
      nameEn: draft.name_en ?? '',
      price: draft.price != null ? String(draft.price) : '',
      notes: draft.notes ?? '',
      colorIndex: Number(extractedColorIndex) || 0,
      step: 5,
      editingDraftId: isPublishedRoute ? null : (draft.id ?? null),
      editingRouteId: isPublishedRoute ? draft.route_id : null,
      isEditMode: true,
    })
  },
  reset: () => set(initialState),
}))