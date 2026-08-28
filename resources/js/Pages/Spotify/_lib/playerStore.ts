import { create } from 'zustand';
import type { SongSummary } from '../types';

interface PlayerState {
  queue: SongSummary[];
  index: number | null;
  playing: boolean;
  currentTime: number;
  // one-shot seek request, consumed by the audio element then reset to null
  seekTo: number | null;
  play: (queue: SongSummary[], index: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  tick: (t: number) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  index: null,
  playing: false,
  currentTime: 0,
  seekTo: null,
  play: (queue, index) => set({ queue, index, playing: true, currentTime: 0, seekTo: 0 }),
  toggle: () => set((s) => (s.index === null ? {} : { playing: !s.playing })),
  next: () => {
    const { queue, index } = get();
    if (index === null) return;
    if (index < queue.length - 1) {
      set({ index: index + 1, playing: true, currentTime: 0, seekTo: 0 });
    } else {
      // end of queue: stop, rewound and ready to replay
      set({ playing: false, currentTime: 0, seekTo: 0 });
    }
  },
  prev: () => {
    const { index, currentTime } = get();
    if (index === null) return;
    if (currentTime > 3 || index === 0) {
      set({ currentTime: 0, seekTo: 0 });
    } else {
      set({ index: index - 1, playing: true, currentTime: 0, seekTo: 0 });
    }
  },
  seek: (t) => set({ seekTo: t, currentTime: t }),
  tick: (t) => set({ currentTime: t }),
  // the audio element is page-scoped while this store is not: without a reset on
  // unmount, the next page auto-plays a stale queue with no controls on screen
  reset: () => set({ queue: [], index: null, playing: false, currentTime: 0, seekTo: null }),
}));

export function useCurrentSong(): SongSummary | null {
  return usePlayerStore((s) => (s.index === null ? null : s.queue[s.index] ?? null));
}
