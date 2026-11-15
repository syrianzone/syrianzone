import { ayahCounts, surahNames } from './source-rules';

interface Manifest {
  font_size: number; line_width: number; content_hash: string;
  suras: [string, number][]; juz: [number, number, number][]; pages: [number, number, number, number][];
}
type RawPart = [line: number, text: string, scale16: number, scale24: number];
type RawAyah = [surah: number, ayah: number, page: number, parts: RawPart[]];
export interface PagePart { text: string; rawText: string; surah: number; ayah: number; realAyah: number; partStretch: number }
export interface PageLine { lineNumber: number; stretch: number; isTitle: boolean; isBasmalah: boolean; titleText: string; basmalahText: string; parts: PagePart[] }
export interface Ayah { key: string; surah: number; ayah: number; text: string; juz: number; page: number }
export interface QuranPage { page: number; juz: number; surahName: string; ayahs: Ayah[]; lines: PageLine[]; anchorSize: number; lineWidth: number; fittedWidth: number; stretchScale: number; fontSize: number }
// Reuse calibration and BiDi rules unchanged. Only the source's browser loader is replaced.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const source = require('../../../../resources/js/Domain/quran/quran') as {
  fittedLineWidth(size: number, width16: number, width24: number): number;
  stretchScaleFor(size: number, width16: number, width24: number): number;
  ensureRtlBidi(token: string): string;
};
let index: Map<number, RawAyah>[] | null = null;
let pending: Promise<void> | null = null;
let manifests: [Manifest, Manifest] | null = null;
const pages = new Map<number, QuranPage>();
function metadata(): [Manifest, Manifest] {
  if (!manifests) {
    // These immutable data files are bundled for first-launch offline reading.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const small = require('../../../../public/quran-data/hafs-16/manifest.json') as Manifest;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const large = require('../../../../public/quran-data/hafs-24/manifest.json') as Manifest;
    manifests = [small, large];
  }
  return manifests;
}
async function ensureData(): Promise<void> {
  if (index) return;
  if (!pending) pending = (async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require('../../../../public/quran-data/mushaf-unified.json') as RawAyah[][];
    const built = Array.from({ length: 114 }, () => new Map<number, RawAyah>());
    let count = 0;
    for (const juz of data) for (const ayah of juz) {
      built[ayah[0]]?.set(ayah[1], ayah);
      if (++count % 300 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    index = built;
  })().catch((reason: unknown) => { pending = null; throw reason; });
  await pending;
}
export async function pageForAyah(surah: number, ayah: number): Promise<number | null> {
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || surah < 1 || surah > 114 || ayah < 1 || ayah > (ayahCounts[surah] ?? 0)) return null;
  const manifest = metadata()[0], internal = ayah + 1, surahIndex = surah - 1;
  const page = manifest.pages.findIndex(([fromSurah, fromAyah, toSurah, toAyah]) =>
    (fromSurah < surahIndex || (fromSurah === surahIndex && fromAyah <= internal)) && (toSurah > surahIndex || (toSurah === surahIndex && toAyah >= internal)));
  return page >= 0 ? page + 1 : null;
}
export async function parseJump(value: string): Promise<{ page: number; ayahKey: string | null } | null> {
  const input = value.trim().replace(/[٠-٩]/g, character => String(character.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, character => String(character.charCodeAt(0) - 0x06f0));
  if (/^\d{1,3}$/.test(input)) return { page: Math.max(1, Math.min(604, Number(input))), ayahKey: null };
  const match = /^(.+?)\s*[:：\-/ ]\s*(\d{1,3})$/.exec(input);
  if (!match?.[1] || !match[2]) return null;
  const name = match[1].replace(/^(?:سورة|سوره)\s+/, '').trim().replace(/\s+/g, ' ');
  const surah = /^\d+$/.test(name) ? Number(name) : surahNames.indexOf(name), ayah = Number(match[2]);
  const page = await pageForAyah(surah, ayah);
  return page === null ? null : { page, ayahKey: `${surah}:${ayah}` };
}
export async function readMushafPage(page: number): Promise<QuranPage> {
  if (!Number.isInteger(page) || page < 1 || page > 604) throw new Error('رقم الصفحة غير صالح.');
  const cached = pages.get(page);
  if (cached) return cached;
  await ensureData();
  const [small, manifest] = metadata(), bounds = manifest.pages[page - 1];
  if (!bounds || !index) throw new Error('بيانات صفحة المصحف غير متاحة.');
  const [fromSurah, fromAyah, toSurah, toAyah] = bounds;
  const lines: PageLine[] = Array.from({ length: 15 }, (_, position) => ({ lineNumber: position + 1, stretch: -1, isTitle: false, isBasmalah: false, titleText: '', basmalahText: '', parts: [] }));
  for (let surah = fromSurah; surah <= toSurah; surah++) {
    const first = surah === fromSurah ? fromAyah : 0, last = surah === toSurah ? toAyah : (manifest.suras[surah]?.[1] ?? 0) - 1;
    for (let ayah = first; ayah <= last; ayah++) {
      const value = index[surah]?.get(ayah);
      if (!value || value[2] !== page) continue;
      for (const [number, rawText, , stretch] of value[3]) {
        const line = lines[number - 1];
        if (!line) continue;
        if (stretch >= 0 && line.stretch < 0) line.stretch = stretch;
        if (((surah === 0 && ayah === 1) || (surah > 0 && ayah === 0)) && rawText.trim()) {
          line.isTitle = true; line.titleText = rawText.trim(); line.stretch = -1; continue;
        }
        if (surah > 0 && surah !== 8 && ayah === 1 && rawText.trim()) {
          line.isBasmalah = true; line.stretch = -1; if (!line.basmalahText) line.basmalahText = rawText; continue;
        }
        if (rawText) line.parts.push({ text: source.ensureRtlBidi(rawText), rawText, surah, ayah, realAyah: ayah >= 2 ? ayah - 1 : 0, partStretch: stretch });
      }
    }
  }
  let juz = 1;
  for (let position = 0; position < manifest.juz.length; position++) if (page >= (manifest.juz[position]?.[2] ?? Infinity)) juz = position + 1;
  const ayahs = new Map<string, Ayah>();
  for (const line of lines) for (const part of line.parts) {
    if (part.realAyah <= 0) continue;
    const key = `${part.surah + 1}:${part.realAyah}`, previous = ayahs.get(key);
    if (previous) previous.text += ` ${part.rawText}`;
    else ayahs.set(key, { key, surah: part.surah + 1, ayah: part.realAyah, text: part.rawText, juz, page });
  }
  const result: QuranPage = { page, juz, surahName: manifest.suras[fromSurah]?.[0] ?? '', ayahs: [...ayahs.values()], lines,
    anchorSize: 24, lineWidth: manifest.line_width, fittedWidth: source.fittedLineWidth(25, small.line_width, manifest.line_width),
    stretchScale: source.stretchScaleFor(25, small.line_width, manifest.line_width), fontSize: 25 };
  pages.set(page, result);
  if (pages.size > 8) { const oldest = pages.keys().next().value; if (oldest !== undefined) pages.delete(oldest); }
  return result;
}

// PORT STATUS: source resources/js/Domain/quran/quran.ts; confidence high; todos 0.
