import { api as client, API_V1 } from '@/Lib/api';

/** One saved ayah, as the reader stores it. */
export interface QuranBookmark {
  surah: number;
  ayah: number;
  page: number;
  juz: number;
  created_at?: string;
}

/** The reader's saved ayahs, one endpoint shared by the hub, the reader and settings sync. */
export function listBookmarks(): Promise<QuranBookmark[]> {
  return client.get<{ bookmarks?: QuranBookmark[] }>(`${API_V1}/quran-bookmarks`)
    .then((data) => data.bookmarks ?? []);
}

export function addBookmark(bookmark: QuranBookmark): Promise<unknown> {
  return client.post(`${API_V1}/quran-bookmarks`, {
    surah: bookmark.surah,
    ayah: bookmark.ayah,
    page: bookmark.page,
    juz: bookmark.juz,
  });
}

export function removeBookmark(surah: number, ayah: number): Promise<unknown> {
  return client.delete(`${API_V1}/quran-bookmarks/${surah}/${ayah}`);
}
