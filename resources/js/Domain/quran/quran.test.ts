import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RECITATION_CODE,
  QURAN_RECITATIONS,
  ayahAudioUrl,
  normalizeRecitationCode,
  recitationByCode,
} from './quran';

describe('normalizeRecitationCode', () => {
  it('keeps a known v4 recitation code', () => {
    expect(normalizeRecitationCode('mahmoud-husary/r1')).toBe('mahmoud-husary/r1');
  });

  it('maps legacy app ids to v4 codes', () => {
    expect(normalizeRecitationCode('husary')).toBe('mahmoud-husary/r1');
    expect(normalizeRecitationCode('husary-mujawwad')).toBe('mahmoud-husary/r2');
    expect(normalizeRecitationCode('abdulbaset')).toBe('abdulbasit-abdulsamad/r3');
    expect(normalizeRecitationCode('muaiqly')).toBe('maher-muaiqly/r1');
  });

  it('maps legacy EveryAyah folders to v4 codes', () => {
    expect(normalizeRecitationCode('Husary_128kbps')).toBe('mahmoud-husary/r1');
    expect(normalizeRecitationCode('Minshawy_Murattal_128kbps')).toBe('muhammad-minshawi/r1');
    expect(normalizeRecitationCode('Alafasy_128kbps')).toBe('mishary-alafasy/r1');
  });

  it('keeps an unknown recitation code for a future-phase recitation', () => {
    expect(normalizeRecitationCode('some-reciter/r9')).toBe('some-reciter/r9');
  });

  it('falls back to the default for junk and empty values', () => {
    expect(normalizeRecitationCode('')).toBe(DEFAULT_RECITATION_CODE);
    expect(normalizeRecitationCode(null)).toBe(DEFAULT_RECITATION_CODE);
    expect(normalizeRecitationCode('nonsense')).toBe(DEFAULT_RECITATION_CODE);
  });
});

describe('recitationByCode', () => {
  it('resolves codes and legacy values', () => {
    expect(recitationByCode('mahmoud-husary/r2').style).toBe('mujawwad');
    expect(recitationByCode('afasy').code).toBe('mishary-alafasy/r1');
  });

  it('returns the default recitation for an unknown code', () => {
    expect(recitationByCode('does-not-exist').code).toBe(DEFAULT_RECITATION_CODE);
  });
});

describe('ayahAudioUrl', () => {
  it('builds the EveryAyah SSSAAA path from the recitation folder', () => {
    const husary = QURAN_RECITATIONS[0];
    expect(ayahAudioUrl(husary, 2, 255)).toBe(
      'https://everyayah.com/data/Husary_128kbps/002255.mp3',
    );
  });

  it('returns an empty string when the recitation has no known folder', () => {
    expect(ayahAudioUrl({ ...QURAN_RECITATIONS[0], folder: null }, 1, 1)).toBe('');
  });
});
