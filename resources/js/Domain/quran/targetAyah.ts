import { create } from 'zustand';

// The ayah the Quran reader should land on after a jump from another surface
// (a bookmark, the radio's "continue in the reader", the global search's surah
// results). It has to outlive the route change into /muslim/quran, so it is a
// store rather than local state — and it lives here because both the Quran
// pages and the shared search write it.
interface QuranTargetState {
  /** "surah:ayah" to land on, or null for the reader's default position. */
  targetAyah: string | null;
  setTargetAyah: (key: string | null) => void;
}

export const useQuranTarget = create<QuranTargetState>((set) => ({
  targetAyah: null,
  setTargetAyah: (targetAyah) => set({ targetAyah }),
}));
