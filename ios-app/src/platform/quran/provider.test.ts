import { expect, test } from 'bun:test';
import { audioUrl, decodeAyahs, decodeLetters, decodeText, decodeWords } from './provider';

test('validates credential-free Quran media paths and keeps timing occurrence and text semantics', () => {
  expect(audioUrl('https://cdn.mp3quran.net/audio/mahmoud-husary/r1/001-64k.mp3')).toContain('001-64k.mp3');
  for (const url of ['http://cdn.mp3quran.net/audio/a/r1/001.mp3', 'https://evil.example/001.mp3', 'file:///private/001.mp3', 'https://user:secret@everyayah.com/data/Husary_128kbps/001001.mp3']) expect(() => audioUrl(url)).toThrow();
  expect(decodeAyahs({ data: { ayahs: [[-1, 0, 500], [1, 500, 1500]] } })).toEqual([[1, 500, 1500]]);
  expect(decodeWords({ data: { words: [[1, 1, 0, 100, 2]], text: { ayahs: [[1, [[1, 'بسم', 'بسم', 1]]]] } } }).words[0]?.[4]).toBe(2);
  expect(decodeText({ data: { ayahs: [[1, [[1, 'بسم', null]]]] } }).get(1)).toEqual([[1, 'بسم', null]]);
  expect(decodeLetters({ data: { letters: [[1, 1, 1, 0, 100, 1, null]] } })[0]?.[6]).toBeNull();
  expect(() => decodeWords({ data: { words: [[1, 1, 100, 0, 1]] } })).toThrow();
});
