import { create } from 'zustand';

export interface StopFeature {
  coordinates: [number, number];
  id: number;
  nameAr: string;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5;

interface StudioState {
  addStop: (coordinate: [number, number]) => void;
  cityId: string;
  drawnLine: [number, number][] | null;
  nameAr: string;
  nameEn: string;
  notes: string;
  price: string;
  removeStop: (id: number) => void;
  reset: () => void;
  setCity: (id: string) => void;
  setDrawnLine: (coordinates: [number, number][] | null) => void;
  setMeta: (
    fields: Partial<Pick<StudioState, 'nameAr' | 'nameEn' | 'notes' | 'price'>>,
  ) => void;
  setStep: (step: WizardStep) => void;
  setSubmittedDraftId: (id: number | null) => void;
  step: WizardStep;
  stops: StopFeature[];
  submittedDraftId: number | null;
  updateStopName: (id: number, nameAr: string) => void;
}

const initialState = {
  cityId: '',
  drawnLine: null,
  nameAr: '',
  nameEn: '',
  notes: '',
  price: '',
  step: 1 as WizardStep,
  stops: [],
  submittedDraftId: null,
};

export const useStudioStore = create<StudioState>((set) => ({
  ...initialState,
  addStop: (coordinates) =>
    set((state) => ({
      stops: [
        ...state.stops,
        { coordinates, id: Date.now(), nameAr: '' },
      ],
    })),
  removeStop: (id) =>
    set((state) => ({ stops: state.stops.filter((stop) => stop.id !== id) })),
  reset: () => set(initialState),
  setCity: (cityId) => set({ cityId }),
  setDrawnLine: (drawnLine) => set({ drawnLine }),
  setMeta: (fields) => set(fields),
  setStep: (step) => set({ step }),
  setSubmittedDraftId: (submittedDraftId) => set({ submittedDraftId }),
  updateStopName: (id, nameAr) =>
    set((state) => ({
      stops: state.stops.map((stop) =>
        stop.id === id ? { ...stop, nameAr } : stop,
      ),
    })),
}));

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_store/useStudioStore.ts (105 lines)
  confidence: high
  todos:      0
  notes:      The five-step studio state remains platform independent.
*/
