import React from 'react';
import { useQuranPlayer } from '@/Lib/quranPlayer';
import { useSurahWords } from '@/Lib/quranText';
import { SURAH_NAMES_AR, recitationByCode } from '@/Pages/Muslim/_lib/quran';

interface Props {
  variant?: 'full' | 'compact';
  className?: string;
}

/**
 * "Now reading" text for the followed recitation: the current ayah, in the
 * recitation's riwayah, with the word being recited highlighted (and its letter
 * sweep). Reused by the radio tab and the Board widget.
 */
export default function QuranNowReading({ variant = 'full', className = '' }: Props) {
  const current = useQuranPlayer((s) => s.current);
  const activeWord = useQuranPlayer((s) => s.activeWord);
  const recitationCode = useQuranPlayer((s) => s.recitationCode);
  const recitation = recitationByCode(recitationCode);
  const words = useSurahWords(current?.surah ?? null, recitation.riwayah);
  const ayahWords = current && words ? words.get(current.ayah) ?? null : null;

  const compact = variant === 'compact';
  const surahName = current ? SURAH_NAMES_AR[current.surah] ?? `سورة ${current.surah}` : null;

  return (
    <div dir="rtl" className={`w-full ${className}`}>
      <div
        className={`flex items-center justify-between gap-2 ${compact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}
      >
        <span className="truncate font-semibold text-foreground">
          {current && surahName ? `${surahName} · آية ${current.ayah}` : 'اختر سورة للاستماع'}
        </span>
        <span className="shrink-0">{recitation.nameAr}</span>
      </div>
      <p
        className={`quran-rasm-uthmani mt-1 text-foreground ${
          compact ? 'max-h-16 overflow-hidden text-lg leading-loose' : 'text-2xl leading-[2.4]'
        }`}
      >
        {current && ayahWords ? (
          ayahWords.map(([pos, rasm], i) => {
            const isActive = activeWord?.ayah === current.ayah && activeWord.position === pos;
            const sweep =
              isActive && activeWord.letterIndex != null && activeWord.letterCount
                ? `${Math.round((activeWord.letterIndex / activeWord.letterCount) * 100)}%`
                : null;
            return (
              <React.Fragment key={pos}>
                {i > 0 ? ' ' : ''}
                <span
                  className={`quran-word${isActive ? ' is-active-word' : ''}`}
                  style={sweep ? ({ '--word-sweep': sweep } as React.CSSProperties) : undefined}
                >
                  {rasm}
                </span>
              </React.Fragment>
            );
          })
        ) : (
          <span className="text-muted-foreground/40">…</span>
        )}
      </p>
    </div>
  );
}
