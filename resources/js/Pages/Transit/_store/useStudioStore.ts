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
  submittedDraftId: number | null

  setStep: (s: WizardStep) => void
  setCity: (id: string) => void
  setDrawnLine: (coords: [number, number][] | null) => void
  addStop: (coord: [number, number]) => void
  updateStopName: (id: number, nameAr: string) => void
  removeStop: (id: number) => void
  setMeta: (fields: Partial<Pick<StudioState, 'nameAr' | 'nameEn' | 'price' | 'notes'>>) => void
  setSubmittedDraftId: (id: number | null) => void
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
  submittedDraftId: null,
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
  removeStop: (id) =>
    set((state) => ({ stops: state.stops.filter((s) => s.id !== id) })),
  setMeta: (fields) => set(fields),
  setSubmittedDraftId: (id) => set({ submittedDraftId: id }),
  reset: () => set(initialState),
}))
