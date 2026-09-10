// Quran Madina 15-line layout engine — port of the quran-madina-layout skill
// (quran-madina-layout/SKILL.md + references + web-reader) to this codebase.
//
// Architecture per skill §1: offline-compiled sharded databases (vendored in
// public/quran-data, zero page images) + lightweight client runtime here:
// lazy Juz shard loading, arbitrary font-size interpolation between the two
// anchors, line layout with scaleX + dynamic clamp, RLM BiDi protection.
//
// Naming follows the quranic-vocab skill: Page/Pages, Juz, Surah, Ayah/Ayat,
// Word/Words, Mushaf, Reciter, Bookmark.

// --- Skill data schemas (references/data-schemas.md) ---

/** Aya line fragment: one segment of an Ayah on a single physical line. */
export interface Part {
  /** Line number on the Page (1..15) */
  l: number;
  /** Text incl. in-line Tatweels and Ayah markers */
  t: string;
  /** Stretch: >= 0 scaleX factor, -1 = center un-stretched */
  s: number;
}

/** Shard record: [0-based Sura, 0-based internal Aya, 1-based Page, parts].
 *  Internal Aya 0 = Sura Title Frame, 1 = Basmala slot, real Ayah A = A+1. */
export type ShardRecord = [number, number, number, Part[]];

export interface JuzShard {
  /** 0-based Juz index (0..29) */
  j: number;
  d: ShardRecord[];
}

export interface MushafManifest {
  title: string;
  published: number;
  font_family: string;
  font_url: string;
  font_size: number;
  line_width: number;
  content_hash: string;
  /** [suraName, totalInternalAyas = realAyas + 2] × 114 */
  suras: Array<[string, number]>;
  /** [startSuraIdx, startInternalAyaIdx, startPage] × 30 */
  juz: Array<[number, number, number]>;
  /** [suraFrom, ayaFrom, suraTo, ayaTo] (0-based internal) × 604 */
  pages: Array<[number, number, number, number]>;
}

// --- Anchors (references/pipeline-and-math.md §2) ---

export const ANCHOR_16 = 16;
export const ANCHOR_24 = 24;

interface AnchorDef {
  size: number;
  dir: string;
}

const ANCHORS: AnchorDef[] = [
  { size: ANCHOR_16, dir: 'hafs-16' },
  { size: ANCHOR_24, dir: 'hafs-24' },
];

/** Nearest anchor per skill: A1 when |S-A1| <= |A2-S|, else A2. */
export function nearestAnchor(size: number): AnchorDef {
  return Math.abs(size - ANCHOR_16) <= Math.abs(ANCHOR_24 - size) ? ANCHORS[0] : ANCHORS[1];
}

function otherAnchor(size: number): AnchorDef {
  return nearestAnchor(size).size === ANCHOR_16 ? ANCHORS[1] : ANCHORS[0];
}

/** Fitted line width LW(S) = round(LW16 + (LW24-LW16)·(S-16)/8). */
export function fittedLineWidth(size: number, lw16: number, lw24: number): number {
  return Math.round(lw16 + (lw24 - lw16) * ((size - ANCHOR_16) / (ANCHOR_24 - ANCHOR_16)));
}

/** Glyph scaling ratio: LW(S)·A_near / (LW(A_near)·S). */
export function stretchScaleFor(size: number, lw16: number, lw24: number): number {
  const near = nearestAnchor(size);
  const lwNear = near.size === ANCHOR_16 ? lw16 : lw24;
  const lwS = fittedLineWidth(size, lw16, lw24);
  return (lwS * near.size) / (lwNear * size);
}

// --- RLM BiDi protection (references/typography-and-text.md §9) ---

export const RLM = '⁤';
export const BASMALA_LIGATURE = '﷽'; // U+FDFD

export function ensureRtlBidi(token: string): string {
  return `${RLM}${token}${RLM}`;
}

// --- Manifest + shard loading (lazy, hash-invalidated) ---

export interface UnifiedPart {
  l: number;
  t: string;
  s16: number;
  s24: number;
}
export type UnifiedData = any[];

interface HydratedUnifiedAya {
  p: number;
  r: UnifiedPart[];
}

interface UnifiedState {
  suras: Array<{ name: string; ayas: Array<HydratedUnifiedAya | null> }>;
  allPromise: Promise<UnifiedData> | null;
}
const unifiedState: UnifiedState = { suras: [], allPromise: null };

interface HydratedAya {
  p: number;
  r: Part[];
}

interface AnchorState {
  manifest: MushafManifest | null;
  manifestPromise: Promise<MushafManifest> | null;
  // Legacy typed manifest state
  // Unified state handles the actual ayas.
}

const HASH_KEY = 'sz-mushaf-hash-';

function anchorState(dir: string): AnchorState {
  let st = states.get(dir);
  if (!st) {
    st = { manifest: null, manifestPromise: null };
    states.set(dir, st);
  }
  return st;
}

const states = new Map<string, AnchorState>();

export async function loadManifest(anchor: AnchorDef): Promise<MushafManifest> {
  const st = anchorState(anchor.dir);
  if (st.manifest) return st.manifest;
  if (!st.manifestPromise) {
    st.manifestPromise = fetch(`/quran-data/${anchor.dir}/manifest.json`)
      .then((r) => {
        if (!r.ok) throw new Error('Mushaf manifest failed');
        return r.json() as Promise<MushafManifest>;
      })
      .then((m) => {
        st.manifest = m;
        if (unifiedState.suras.length === 0) {
          unifiedState.suras = m.suras.map(([name, total]) => ({
            name,
            ayas: new Array<HydratedUnifiedAya | null>(total).fill(null),
          }));
        }
        // Skill §3: content_hash invalidates stale cached shards.
        try {
          if (typeof window !== 'undefined') {
            const key = HASH_KEY + anchor.dir;
            const prev = window.localStorage.getItem(key);
            if (prev && prev !== m.content_hash && 'caches' in window) {
              void caches.keys().then((keys) => {
                for (const k of keys) {
                  if (k.includes('runtime')) void caches.delete(k);
                }
              });
            }
            window.localStorage.setItem(key, m.content_hash);
          }
        } catch {
          // private mode: skip persistence
        }
        return m;
      })
      .catch((e) => {
        st.manifestPromise = null;
        throw e;
      });
  }
  return st.manifestPromise;
}

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

export function loadAll(): Promise<UnifiedData> {
  if (unifiedState.allPromise) return unifiedState.allPromise;
  
  unifiedState.allPromise = (async () => {
    try {
      const res = await fetch('/quran-data/mushaf-unified.json');
      if (!res.ok) throw new Error('Mushaf unified failed');
      const data = await res.json() as any[];
      
      let iterations = 0;
      for (const juzArray of data) {
        for (const [sIdx, aIdx, page, partsTuple] of juzArray) {
          const sura = unifiedState.suras[sIdx];
          if (sura && aIdx < sura.ayas.length) {
            const r: UnifiedPart[] = partsTuple.map((pt: any) => ({
              l: pt[0],
              t: pt[1],
              s16: pt[2],
              s24: pt[3]
            }));
            sura.ayas[aIdx] = { p: page, r };
          }
          if (++iterations % 300 === 0) await yieldToMain();
        }
      }
      return data;
    } catch (e) {
      unifiedState.allPromise = null;
      throw e;
    }
  })();
  
  return unifiedState.allPromise;
}

/** 0-based Juz index containing internal (sura, aya) — port of suraAyaToJuz. */
export function suraAyaToJuz(manifest: MushafManifest, s: number, a: number): number {
  let juzIdx = 0;
  for (let k = 0; k < manifest.juz.length; k++) {
    const start = manifest.juz[k];
    if (start[0] < s || (start[0] === s && start[1] <= a)) juzIdx = k;
    else break;
  }
  return juzIdx;
}
/** 1-based Juz number for a 1-based Page. */
export function juzNumberForPage(manifest: MushafManifest, page: number): number {
  let juzNum = 1;
  for (let i = 0; i < manifest.juz.length; i++) {
    if (page >= manifest.juz[i][2]) juzNum = i + 1;
    else break;
  }
  return juzNum;
}

/**
 * Page (1..604) containing a real Ayah (1-based Surah + Ayah), resolved from
 * the manifest page boundaries. Null when out of range. Needs no shard data.
 */
export async function findPageForVerse(surah1: number, ayah1: number): Promise<number | null> {
  if (!Number.isInteger(surah1) || !Number.isInteger(ayah1) || surah1 < 1 || surah1 > 114 || ayah1 < 1) {
    return null;
  }
  const manifest = await loadManifest(ANCHORS[0]);
  const s0 = surah1 - 1;
  const aInternal = ayah1 + 1; // real Ayah A lives at internal index A+1
  for (let p = 0; p < manifest.pages.length; p++) {
    const [sFrom, aFrom, sTo, aTo] = manifest.pages[p];
    const afterStart = sFrom < s0 || (sFrom === s0 && aFrom <= aInternal);
    const beforeEnd = sTo > s0 || (sTo === s0 && aTo >= aInternal);
    if (afterStart && beforeEnd) return p + 1;
  }
  return null;
}

/** Primary Surah name for the Page header. */
export function suraNameForPage(manifest: MushafManifest, page: number): string {
  const bounds = manifest.pages[page - 1];
  if (!bounds) return manifest.suras[0]?.[0] ?? '';
  return manifest.suras[bounds[0]]?.[0] ?? '';
}

/** Ensure the Juz shard(s) covering a Page are loaded (both when spanning). */
async function ensureUnified(): Promise<void> {
  await loadAll();
}

// --- Page render model (port of renderPageData) ---

export interface PagePart {
  /** RLM-wrapped display text (continuous part, never word-split). */
  text: string;
  rawText: string;
  /** 0-based Sura / internal Aya indices. */
  sura: number;
  aya: number;
  /** 1-based real Ayah number (0 for decoration). */
  realAya: number;
  partStretch: number;
}

export interface PageLine {
  lineNumber: number;
  stretch: number;
  isTitle: boolean;
  isBasmala: boolean;
  titleText: string;
  /** Raw 4-word Basmala text (rendered as words: the Hafs subset font
   *  has no U+FDFD ligature glyph, verified against its cmap). */
  basmalaText: string;
  parts: PagePart[];
}

export interface Ayah {
  /** "2:255" (1-based Surah : real Ayah). */
  key: string;
  surah: number;
  ayah: number;
  /** Joined raw part text for display/selection. */
  text: string;
  juz: number;
  page: number;
}

export interface QuranPage {
  page: number;
  juz: number;
  suraName: string;
  ayat: Ayah[];
  lines: PageLine[];
  /** Anchor calibration + interpolation for the requested size. */
  anchorSize: number;
  lineWidth: number;
  fittedWidth: number;
  stretchScale: number;
  fontSize: number;
}

/** Build the 15-line Page model for any requested font size. */
export async function renderMushafPage(page: number, fontSize: number, signal?: AbortSignal): Promise<QuranPage> {
  if (page < 1 || page > TOTAL_PAGES) throw new Error(`Invalid page: ${page}`);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const anchor = nearestAnchor(fontSize);
  const [manifest, other] = await Promise.all([loadManifest(anchor), loadManifest(otherAnchor(fontSize))]);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const lw16 = manifest.font_size === 16 ? manifest.line_width : other.line_width;
  const lw24 = manifest.font_size === 24 ? manifest.line_width : other.line_width;
  const fitted = fittedLineWidth(fontSize, lw16, lw24);
  const scale = stretchScaleFor(fontSize, lw16, lw24);

  await ensureUnified();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  
  const bounds = manifest.pages[page - 1];
  const [sFrom, aFrom, sTo, aTo] = bounds;

  const lines: PageLine[] = [];
  for (let l = 1; l <= 15; l++) {
    lines.push({ lineNumber: l, stretch: -1, isTitle: false, isBasmala: false, titleText: '', basmalaText: '', parts: [] });
  }

  for (let s = sFrom; s <= sTo; s++) {
    const startA = s === sFrom ? aFrom : 0;
    const total = unifiedState.suras[s]?.ayas.length ?? 0;
    const endA = s === sTo ? aTo : total - 1;
    for (let a = startA; a <= endA; a++) {
      const aya = unifiedState.suras[s]?.ayas[a];
      if (!aya || aya.p !== page) continue;
      for (const part of aya.r) {
        const lineObj = lines[part.l - 1];
        if (!lineObj) continue;

        const partStretch = anchor.size === 16 ? part.s16 : part.s24;

        if (partStretch >= 0 && lineObj.stretch < 0) lineObj.stretch = partStretch;

        // Sura Title Frame (slot 0 for s > 0, slot 1 for s == 0 — Fatiha).
        const isTitleSlot = (s === 0 && a === 1) || (s > 0 && a === 0);
        if (isTitleSlot && part.t && part.t.trim().length > 0) {
          lineObj.isTitle = true;
          lineObj.titleText = part.t.trim();
          lineObj.stretch = -1;
          continue;
        }
        // Basmala slot (s > 0 except At-Tawba s == 8): keep the 4-word text
        // for rendering (the Hafs subset has no U+FDFD ligature glyph).
        const isBasmalaSlot = s > 0 && s !== 8 && a === 1;
        if (isBasmalaSlot && part.t && part.t.trim().length > 0) {
          lineObj.isBasmala = true;
          lineObj.stretch = -1;
          if (!lineObj.basmalaText) lineObj.basmalaText = part.t;
          continue;
        }
        if (part.t && part.t.length > 0) {
          const realAya = a >= 2 ? a - 1 : 0;
          lineObj.parts.push({
            text: ensureRtlBidi(part.t),
            rawText: part.t,
            sura: s,
            aya: a,
            realAya,
            partStretch: partStretch,
          });
        }
      }
    }
  }

  const juz = juzNumberForPage(manifest, page);
  const suraName = suraNameForPage(manifest, page);

  // Ayah list for the audio player + highlight (real Ayahs only).
  const byAya = new Map<string, Ayah>();
  for (const line of lines) {
    for (const p of line.parts) {
      if (p.realAya <= 0) continue;
      const key = `${p.sura + 1}:${p.realAya}`;
      const hit = byAya.get(key);
      if (hit) hit.text += ` ${p.rawText}`;
      else byAya.set(key, { key, surah: p.sura + 1, ayah: p.realAya, text: p.rawText, juz, page });
    }
  }

  return {
    page,
    juz,
    suraName,
    ayat: [...byAya.values()],
    lines,
    anchorSize: anchor.size,
    lineWidth: anchor.size === ANCHOR_16 ? lw16 : lw24,
    fittedWidth: fitted,
    stretchScale: scale,
    fontSize,
  };
}

export function juzOfPageEstimate(page: number): number {
  return Math.min(30, Math.max(1, Math.ceil((page / 604) * 30)));
}

// --- Reciters (EveryAyah per-Ayah MP3s; folders verified at everyayah.com) ---

export interface Reciter {
  id: string;
  nameAr: string;
  nameEn: string;
  folder: string;
}

export const QURAN_RECITERS: Reciter[] = [
  { id: 'husary', nameAr: 'محمود خليل الحصري (مرتل)', nameEn: 'Husary (Murattal)', folder: 'Husary_128kbps' },
  { id: 'husary-mujawwad', nameAr: 'الحصري (مجوّد)', nameEn: 'Husary (Mujawwad)', folder: 'Husary_128kbps_Mujawwad' },
  { id: 'minshawi', nameAr: 'محمد صديق المنشاوي (مرتل)', nameEn: 'Minshawi (Murattal)', folder: 'Minshawy_Murattal_128kbps' },
  { id: 'abdulbaset', nameAr: 'عبد الباسط عبد الصمد (مرتل)', nameEn: 'AbdulBaset (Murattal)', folder: 'Abdul_Basit_Murattal_192kbps' },
  { id: 'afasy', nameAr: 'مشاري العفاسي', nameEn: 'Alafasy', folder: 'Alafasy_128kbps' },
  { id: 'muaiqly', nameAr: 'ماهر المعيقلي', nameEn: 'Maher Al-Muaiqly', folder: 'MaherAlMuaiqly128kbps' },
];

export const DEFAULT_RECITER_ID = 'husary';

export function reciterById(id: string): Reciter {
  return QURAN_RECITERS.find((r) => r.id === id) ?? QURAN_RECITERS[0];
}

/** EveryAyah per-Ayah file: SSSAA A zero-padded, e.g. 002255.mp3 */
export function ayahAudioUrl(reciter: Reciter, surah: number, ayah: number): string {
  const s = String(surah).padStart(3, '0');
  const a = String(ayah).padStart(3, '0');
  return `https://everyayah.com/data/${reciter.folder}/${s}${a}.mp3`;
}

export const TOTAL_PAGES = 604;
export const TOTAL_JUZ = 30;

/** 1-based Surah names for labels (audio player, headers). */
export const SURA_NAMES_AR = ['', 'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص', 'الفلق', 'الناس'];
