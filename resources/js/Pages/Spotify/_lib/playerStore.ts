import { create } from 'zustand';
import type { SongSummary } from '../types';

export type RepeatMode = 'off' | 'all' | 'one';

const VOLUME_KEY = 'sz-spotify-volume';
const SAVED_KEY = 'sz-spotify-saved';

function writeStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage blocked or full: the preference just does not survive a reload
  }
}

function readSavedIds(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

function readVolume(): number {
  if (typeof window === 'undefined') return 1;
  const raw = window.localStorage.getItem(VOLUME_KEY);
  const v = raw === null ? NaN : Number(raw);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

// shuffle keeps the queue intact and walks `order`, a shuffled list of queue
// indices with the current track pinned first
function shuffledOrder(length: number, first: number): number[] {
  const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [first, ...rest];
}

interface PlayerState {
  queue: SongSummary[];
  index: number | null;
  playing: boolean;
  currentTime: number;
  // one-shot seek request, consumed by the audio element then reset to null
  seekTo: number | null;
  shuffle: boolean;
  order: number[];
  repeat: RepeatMode;
  volume: number;
  muted: boolean;
  savedIds: number[];
  play: (queue: SongSummary[], index: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  onEnded: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (v: number) => void;
  toggleMuted: () => void;
  toggleSaved: (id: number) => void;
  hydratePrefs: () => void;
  seek: (t: number) => void;
  tick: (t: number) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  // sequence of queue indices in play order; identity unless shuffle is on
  const playOrder = (): number[] => {
    const { queue, shuffle, order } = get();
    return shuffle && order.length === queue.length ? order : queue.map((_, i) => i);
  };

  return {
    queue: [],
    index: null,
    playing: false,
    currentTime: 0,
    seekTo: null,
    shuffle: false,
    order: [],
    repeat: 'off',
    volume: 1,
    muted: false,
    savedIds: [],
    play: (queue, index) =>
      set((s) => ({
        queue,
        index,
        playing: true,
        currentTime: 0,
        seekTo: 0,
        order: s.shuffle ? shuffledOrder(queue.length, index) : [],
      })),
    toggle: () => set((s) => (s.index === null ? {} : { playing: !s.playing })),
    next: () => {
      const { index, repeat } = get();
      if (index === null) return;
      const seq = playOrder();
      const pos = seq.indexOf(index);
      if (pos < seq.length - 1) {
        set({ index: seq[pos + 1], playing: true, currentTime: 0, seekTo: 0 });
      } else if (repeat === 'all') {
        set({ index: seq[0], playing: true, currentTime: 0, seekTo: 0 });
      } else {
        // end of queue: stop, rewound and ready to replay
        set({ playing: false, currentTime: 0, seekTo: 0 });
      }
    },
    prev: () => {
      const { index, currentTime } = get();
      if (index === null) return;
      const seq = playOrder();
      const pos = seq.indexOf(index);
      if (currentTime > 3 || pos <= 0) {
        set({ currentTime: 0, seekTo: 0 });
      } else {
        set({ index: seq[pos - 1], playing: true, currentTime: 0, seekTo: 0 });
      }
    },
    onEnded: () => {
      if (get().repeat === 'one') set({ currentTime: 0, seekTo: 0, playing: true });
      else get().next();
    },
    toggleShuffle: () =>
      set((s) => ({
        shuffle: !s.shuffle,
        order: !s.shuffle && s.index !== null ? shuffledOrder(s.queue.length, s.index) : [],
      })),
    cycleRepeat: () =>
      set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),
    setVolume: (v) => {
      const volume = Math.min(1, Math.max(0, v));
      set({ volume, muted: false });
      writeStorage(VOLUME_KEY, String(volume));
    },
    toggleMuted: () => set((s) => ({ muted: !s.muted })),
    toggleSaved: (id) =>
      set((s) => {
        const savedIds = s.savedIds.includes(id)
          ? s.savedIds.filter((x) => x !== id)
          : [...s.savedIds, id];
        writeStorage(SAVED_KEY, JSON.stringify(savedIds));
        return { savedIds };
      }),
    // called after mount: localStorage is unavailable during ssr, and reading it
    // before hydration would make client markup diverge from the server html
    hydratePrefs: () => set({ volume: readVolume(), savedIds: readSavedIds() }),
    seek: (t) => set({ seekTo: t, currentTime: t }),
    tick: (t) => set({ currentTime: t }),
    // the audio element is page-scoped while this store is not: without a reset on
    // unmount, the next page auto-plays a stale queue with no controls on screen
    reset: () => set({ queue: [], index: null, playing: false, currentTime: 0, seekTo: null, order: [] }),
  };
});

export function useCurrentSong(): SongSummary | null {
  return usePlayerStore((s) => (s.index === null ? null : s.queue[s.index] ?? null));
}
