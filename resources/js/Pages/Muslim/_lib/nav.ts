import { create } from 'zustand';

// Cross-page state for the Muslim Corner. Each tool lives at its own real
// route (`/muslim/prayer|quran|radio`), so there is no `view` here — only state
// a Muslim route has to carry across a navigation. The app-wide UI state the
// shell also reads lives in `Lib/appShell.ts`; the reader's jump target lives
// in `Domain/quran/targetAyah.ts`.
interface MuslimNavState {
  /**
   * Radio sleep timer: the epoch ms at which playback stops, or null for
   * endless. It lives here rather than in the applet so the countdown keeps
   * running while the user reads the Quran or checks prayer times.
   */
  radioSleepUntil: number | null;
  setRadioSleepUntil: (until: number | null) => void;
}

export const useMuslimNav = create<MuslimNavState>((set) => ({
  radioSleepUntil: null,
  setRadioSleepUntil: (radioSleepUntil) => set({ radioSleepUntil }),
}));
