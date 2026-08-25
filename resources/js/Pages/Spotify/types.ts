export interface SongSummary {
  id: number;
  title: string;
  artist: string | null;
  slug: string;
  status: string;
  lyrics_status: string;
  duration_seconds: number | null;
  audio_url: string | null;
  cover_url: string | null;
  has_lyrics: boolean;
  created_at: string;
}

export interface SongFull extends SongSummary {
  lyrics_lrc: string | null;
}

export interface PlaylistInfo {
  name: string;
  slug: string;
}
