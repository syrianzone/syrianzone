export interface AdminSong {
  id: number;
  title: string;
  artist: string | null;
  slug: string;
  status: 'processing' | 'ready' | 'failed';
  lyrics_status: 'none' | 'pending' | 'ready' | 'failed';
  duration_seconds: number | null;
  audio_url: string | null;
  cover_url: string | null;
  has_lyrics: boolean;
  created_at: string;
  lyrics_lrc: string | null;
  error: string | null;
}

export function apiError(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { message?: string } } };
  const message = err.response?.data?.message;
  // only trust the app's own Arabic messages; Laravel defaults are English
  if (message && /[؀-ۿ]/.test(message)) return message;
  return fallback;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
