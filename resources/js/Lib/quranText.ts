import { useEffect, useState } from 'react';
import { getSurahText, type TextWord } from '@/Pages/Muslim/_lib/mp3quran';

// Written words of a surah, by ayah, in the recitation's riwayah. Cached per
// (riwayah, surah) so the followed-recitation text does not refetch as it walks
// ayah by ayah.

const cache = new Map<string, Map<number, TextWord[]>>();
const pending = new Map<string, Promise<Map<number, TextWord[]>>>();

function load(surah: number, riwayah: string): Promise<Map<number, TextWord[]>> {
  const key = `${riwayah}:${surah}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(key);
  if (existing) return existing;
  const request = getSurahText(surah, { riwayah })
    .then((res) => {
      const map = new Map<number, TextWord[]>();
      for (const [ayah, words] of res.ayahs) map.set(ayah, words);
      cache.set(key, map);
      pending.delete(key);
      return map;
    })
    .catch((e) => {
      pending.delete(key);
      throw e;
    });
  pending.set(key, request);
  return request;
}

export function useSurahWords(surah: number | null, riwayah: string): Map<number, TextWord[]> | null {
  const [words, setWords] = useState<Map<number, TextWord[]> | null>(() =>
    surah ? cache.get(`${riwayah}:${surah}`) ?? null : null,
  );

  useEffect(() => {
    if (!surah) {
      setWords(null);
      return;
    }
    let live = true;
    const cached = cache.get(`${riwayah}:${surah}`);
    if (cached) {
      setWords(cached);
      return;
    }
    load(surah, riwayah)
      .then((map) => {
        if (live) setWords(map);
      })
      .catch(() => {
        if (live) setWords(null);
      });
    return () => {
      live = false;
    };
  }, [surah, riwayah]);

  return words;
}
