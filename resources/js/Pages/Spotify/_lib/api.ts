import axios from '@/Lib/axios';

const base = '/api/v1/spotify';
const STORAGE_KEY = 'sz-spotify-playlists';

function readTokens(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function savedEditToken(slug: string): string | null {
  return readTokens()[slug] ?? null;
}

export function rememberEditToken(slug: string, token: string): void {
  if (typeof window === 'undefined') return;
  const tokens = readTokens();
  tokens[slug] = token;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // storage blocked or full: the share link still works, only editing is lost
  }
}

export async function createPlaylist(
  name: string,
  songIds: number[]
): Promise<{ slug: string; edit_token: string; url: string }> {
  const { data } = await axios.post(`${base}/playlists`, { name, song_ids: songIds });
  return data;
}

export async function updatePlaylist(
  slug: string,
  editToken: string,
  patch: { name?: string; song_ids?: number[] }
): Promise<void> {
  await axios.put(`${base}/playlists/${slug}`, { edit_token: editToken, ...patch });
}

// the index only ships song summaries; the lyrics panel fetches them on demand
export async function fetchSongLyrics(slug: string): Promise<string | null> {
  const { data } = await axios.get<{ lyrics_lrc: string | null }>(`/api/v1/spotify/songs/${slug}`);
  return data.lyrics_lrc ?? null;
}

const STATUS_MESSAGES: Record<number, string> = {
  403: 'غير مسموح لك بهذا الإجراء، رمز التعديل غير صحيح',
  404: 'العنصر غير موجود',
  419: 'انتهت الجلسة، أعد تحميل الصفحة',
  422: 'تحقق من البيانات المدخلة',
  429: 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة',
};

export function extractError(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { message?: string } } };
  const message = err.response?.data?.message;
  // only trust the app's own Arabic messages; Laravel defaults are English
  if (message && /[؀-ۿ]/.test(message)) return message;
  const status = err.response?.status;
  return (status !== undefined && STATUS_MESSAGES[status]) || 'حدث خطأ، حاول مجدداً';
}
