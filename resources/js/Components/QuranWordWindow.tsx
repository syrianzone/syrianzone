import React, { useMemo, useRef } from 'react';
import { useQuranPlayer } from '@/Lib/quranPlayer';
import { useSurahWords } from '@/Lib/quranText';
import { SURAH_NAMES_AR, recitationByCode } from '@/Pages/Muslim/_lib/quran';

// A teleprompter-style window for the followed recitation: five words, the one
// being recited in the middle, with ayah numbers as separators where an ayah
// ends inside the window. Word-level only (no letter timings), and it does not
// follow the Madina page layout.

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function arabicNumber(n: number): string {
  return String(n)
    .split('')
    .map((d) => AR_DIGITS[Number(d)])
    .join('');
}

interface FlatWord {
  ayah: number;
  position: number;
  text: string;
}

const WINDOW = 5;
const HALF = Math.floor(WINDOW / 2);

interface Props {
  className?: string;
}

export default function QuranWordWindow({ className = '' }: Props) {
  const current = useQuranPlayer((s) => s.current);
  const activeWord = useQuranPlayer((s) => s.activeWord);
  const recitationCode = useQuranPlayer((s) => s.recitationCode);
  const recitation = recitationByCode(recitationCode);
  const words = useSurahWords(current?.surah ?? null, recitation.riwayah);

  const flat = useMemo<FlatWord[]>(() => {
    if (!words) return [];
    const out: FlatWord[] = [];
    for (const ayah of [...words.keys()].sort((a, b) => a - b)) {
      for (const [pos, rasm] of words.get(ayah) ?? []) out.push({ ayah, position: pos, text: rasm });
    }
    return out;
  }, [words]);

  // Hold the last word so the window does not flicker in the gaps between words.
  const last = useRef<{ ayah: number; position: number } | null>(null);
  if (activeWord) last.current = { ayah: activeWord.ayah, position: activeWord.position };
  const focus = last.current;

  const idx = focus
    ? flat.findIndex((w) => w.ayah === focus.ayah && w.position === focus.position)
    : -1;

  const slots: (FlatWord | null)[] = idx >= 0
    ? Array.from({ length: WINDOW }, (_, i) => flat[idx + i - HALF] ?? null)
    : new Array(WINDOW).fill(null);

  const surahName = current ? SURAH_NAMES_AR[current.surah] ?? `سورة ${current.surah}` : null;

  return (
    <div dir="rtl" className={`w-full ${className}`}>
      {surahName && (
        <div className="mb-1 text-center text-xs font-semibold text-muted-foreground">{surahName}</div>
      )}
      <div className="flex min-h-[3.5rem] flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {slots.map((word, i) => {
          const isCenter = i === HALF;
          const next = slots[i + 1];
          const separatorAfter = word && next && next.ayah !== word.ayah;
          return (
            <React.Fragment key={word ? `w${word.ayah}-${word.position}` : `pad${i}`}>
              {word ? (
                <span
                  className={`quran-rasm-uthmani text-2xl transition-colors ${
                    isCenter ? 'font-bold text-primary' : 'text-foreground/70'
                  }`}
                >
                  {word.text}
                </span>
              ) : (
                <span className="inline-block min-w-[1.5rem]" aria-hidden="true" />
              )}
              {separatorAfter && (
                <span className="quran-rasm-uthmani text-base text-muted-foreground/70">
                  {`﴿${arabicNumber(word.ayah)}﴾`}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
