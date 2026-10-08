import { describe, expect, it } from 'vitest';
import type { V4Radio } from '@/Pages/Muslim/_lib/mp3quran';
import {
  CURATED_QURAN_RADIOS,
  POPULAR_QURAN_RADIO_IDS,
  mapRecitationRadio,
  mapRecitationRadios,
  orderStations,
} from './quranRadio';

function radio(over: Partial<V4Radio>): V4Radio {
  return {
    id: 1,
    name: 'قارئ',
    stream_url: 'https://backup.qurango.net/radio/x',
    category: 'القراء',
    ...over,
  };
}

describe('mapRecitationRadio', () => {
  it('keeps a single-reciter station from an allowlisted category', () => {
    expect(mapRecitationRadio(radio({ id: 74, name: 'محمود خليل الحصري' }))).toEqual({
      id: 74,
      name: 'محمود خليل الحصري',
      url: 'https://backup.qurango.net/radio/x',
    });
  });

  it('keeps the ten-qiraahs category', () => {
    expect(mapRecitationRadio(radio({ category: 'القراءات العشر' }))).not.toBeNull();
  });

  it('drops translation, stories and tafsir categories', () => {
    for (const category of [
      'ترجمة معاني القرآن الكريم',
      'السيرة والقصص',
      'التفسير وعلوم القرآن',
      'الأدعية والأذكار',
      'السنة النبوية',
      'الرقية الشرعية',
      'الفتاوى',
      'مواسم الخير',
      'تلاوات متميزة',
      'إذاعة القرآن الكريم - السعودية',
    ]) {
      expect(mapRecitationRadio(radio({ category }))).toBeNull();
    }
  });

  it('trims trailing dashes from the upstream name', () => {
    expect(mapRecitationRadio(radio({ name: 'تلاوات خاشعة---' }))?.name).toBe('تلاوات خاشعة');
  });

  it('drops a station without a stream url', () => {
    expect(mapRecitationRadio(radio({ stream_url: '' }))).toBeNull();
  });
});

describe('mapRecitationRadios', () => {
  it('keeps only recitation rows, preserving order', () => {
    const list = mapRecitationRadios([
      radio({ id: 1, category: 'القراء' }),
      radio({ id: 2, category: 'ترجمة معاني القرآن الكريم' }),
      radio({ id: 3, category: 'القراءات العشر' }),
    ]);
    expect(list.map((s) => s.id)).toEqual([1, 3]);
  });
});

describe('orderStations', () => {
  it('pins popular reciters first, then sorts the rest by Arabic name', () => {
    const stations = [
      { id: 1, name: 'ب', url: 'u1' },
      { id: POPULAR_QURAN_RADIO_IDS[0], name: 'ز', url: 'u2' },
      { id: POPULAR_QURAN_RADIO_IDS[1], name: 'و', url: 'u3' },
      { id: 2, name: 'أ', url: 'u4' },
    ];
    const ordered = orderStations(stations);
    expect(ordered[0].id).toBe(POPULAR_QURAN_RADIO_IDS[0]);
    expect(ordered[1].id).toBe(POPULAR_QURAN_RADIO_IDS[1]);
    expect(ordered.slice(2).map((s) => s.name)).toEqual(['أ', 'ب']);
  });
});

describe('CURATED_QURAN_RADIOS', () => {
  it('covers the pinned reciters so the offline fallback is never empty', () => {
    const ids = new Set(CURATED_QURAN_RADIOS.map((s) => s.id));
    for (const id of POPULAR_QURAN_RADIO_IDS) expect(ids.has(id)).toBe(true);
  });
});
