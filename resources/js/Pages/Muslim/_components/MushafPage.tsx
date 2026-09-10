import React, { useLayoutEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import AyahMarker, { splitMarkerTokens } from './ayah-marker/AyahMarker';
import { BASMALA_LIGATURE, ensureRtlBidi, type QuranPage } from '../_lib/quran';

interface Props {
  data: QuranPage;
  /** "sura:aya" of the Ayah the audio player is on (highlight). */
  currentAyahKey: string | null;
  onSelectAyah: (key: string) => void;
  /** Cap the rendered height (mobile fit-to-viewport); null = natural size. */
  maxHeight?: number | null;
  /** "sura:aya" keys with a bookmark (subtle in-text marking). */
  savedKeys?: Set<string>;
  onToggleBookmark?: () => void;
  bookmarkBusy?: boolean;
  /** Kept for compat — the page always scales to fill the viewport now. */
  forceFit?: boolean;
}

/** Widths of the original inline marker tokens per digit-count, measured in
 *  the Hafs font so SVG rosettes match the advance the scaleX factor expects. */
function useMarkerWidths(fontSize: number): {
  ref: React.RefObject<HTMLDivElement | null>;
  widths: Record<number, number>;
} {
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [widths, setWidths] = useState<Record<number, number>>({});

  useLayoutEffect(() => {
    const measure = () => {
      const root = measureRef.current;
      if (!root) return;
      const spans = root.querySelectorAll<HTMLElement>('[data-digits]');
      if (spans.length === 0) return;
      const next: Record<number, number> = {};
      spans.forEach((el) => {
        const n = Number(el.dataset.digits);
        if (el.offsetWidth > 0) next[n] = el.offsetWidth;
      });
      if (Object.keys(next).length > 0) setWidths(next);
    };
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => measure()).catch(() => measure());
    } else {
      measure();
    }
  }, [fontSize]);

  return { ref: measureRef, widths };
}

/**
 * Pixel-faithful Madina page — port of the skill's web-reader renderer:
 * header (Surah right, Juz left), exactly 15 lines, footer (Page number).
 * Justified lines get GPU scaleX from the right edge with the skill's dynamic
 * clamp min(s·stretchScale, LW(S)/W_measured); centered slots skip it.
 * Parts render continuous (white-space: pre, never word-split per skill §10);
 * inline ﴿﴾ tokens are swapped for quranpedia SVG rosettes sized to the
 * original advance so justification is preserved.
 */
export default function MushafPage({ data, currentAyahKey, onSelectAyah, maxHeight, savedKeys, onToggleBookmark, bookmarkBusy, forceFit }: Props) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const markerWidths = useMarkerWidths(data.fontSize);
  const markerW = markerWidths.widths;

  const frameWidth = data.lineWidth + 4; // line box + page padding (2px each side)

  const hoverAya = (sura: number, aya: number, on: boolean) => {
    pageRef.current
      ?.querySelectorAll(`.quran-part[data-sura="${sura}"][data-aya="${aya}"]`)
      .forEach((el) => el.classList.toggle('is-hovered', on));
  };

  // Measure + justify after fonts are ready (wrong widths otherwise).
  useLayoutEffect(() => {
    let cancelled = false;
    const root = pageRef.current;
    if (!root) return;

    const justify = () => {
      if (cancelled || !root) return;
      const target = data.lineWidth;
      const stretchScale = data.stretchScale;
      root.querySelectorAll<HTMLElement>('.quran-line').forEach((lineEl, idx) => {
        const line = data.lines[idx];
        const content = lineEl.querySelector<HTMLElement>('.line-content');
        if (!line || !content) return;
        if (!line || line.isTitle || line.isBasmala || line.stretch < 0) return;
        const measured = content.scrollWidth;
        const requested = line.stretch * stretchScale;
        let effective = requested;
        if (measured > 0 && measured * requested > target + 0.5) {
          effective = target / measured;
        }
        content.style.transformOrigin = '100% 0%';
        content.style.transform = `scaleX(${effective.toFixed(4)})`;
      });
    };

    const fit = () => {
      if (cancelled || !root) return;
      // NOTE: root.parentElement is the w-fit wrapper (shrinks to content),
      // so measure the slot column (grandparent) for real available width.
      const slot = root.parentElement?.parentElement ?? root.parentElement;
      const availW = slot ? slot.clientWidth : frameWidth;
      // Always fill the viewport: scale up or down until either the
      // width or the height limit is hit (font is fixed at 25px).
      const wFit = availW / frameWidth;
      const naturalH = root.offsetHeight;
      const hFit = (maxHeight && naturalH > 0) ? maxHeight / naturalH : wFit;

      setFitScale(Math.min(wFit, hFit));
      setPageHeight(naturalH);
    };

    const run = () => {
      justify();
      fit();
    };

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => run()).catch(() => run());
    } else {
      run();
    }
    window.addEventListener('resize', fit);
    const slot = root.parentElement?.parentElement;
    const ro = slot ? new ResizeObserver(fit) : null;
    if (slot) ro!.observe(slot);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', fit);
      ro?.disconnect();
    };
  }, [data, frameWidth, markerW, maxHeight]);

  const scaled = fitScale !== 1 && pageHeight;
  return (
    <div
      style={
        scaled
          ? { width: frameWidth * fitScale, height: pageHeight * fitScale }
          : { width: 'fit-content', maxWidth: '100%' }
      }
      className="mx-auto flex flex-none items-start justify-center"
    >
      <div
        ref={pageRef}
        className="mushaf-page flex-none"
        dir="rtl"
        style={
          {
            width: frameWidth,
            transform: scaled ? `scale(${fitScale})` : undefined,
            transformOrigin: 'top center',
            '--quran-font-size': `${data.fontSize}px`,
            '--target-line-width': `${data.lineWidth}px`,
          } as React.CSSProperties
        }
      >
        {/* Hidden measurer for original marker advances (Hafs, current size). */}
        <div
          ref={markerWidths.ref}
          aria-hidden="true"
          style={{
            position: 'absolute',
            visibility: 'hidden',
            pointerEvents: 'none',
            whiteSpace: 'pre',
            fontFamily: "'KFGQPC HAFS Uthmanic Script', serif",
            fontSize: data.fontSize,
          }}
        >
          <span data-digits="1">﴿١﴾</span>
          <span data-digits="2">﴿١٢﴾</span>
          <span data-digits="3">﴿١٢٣﴾</span>
        </div>

        <div className="mushaf-lines-container">
          {data.lines.map((line) => (
            <div key={line.lineNumber} className="quran-line" data-line-num={line.lineNumber}>
              {line.isTitle ? (
                <div className="sura-title-frame">
                  <span className="sura-title-text">{line.titleText}</span>
                </div>
              ) : line.isBasmala ? (
                <div className="line-content centered">
                  <span className="basmala-ligature">
                    {line.basmalaText ? ensureRtlBidi(line.basmalaText) : BASMALA_LIGATURE}
                  </span>
                </div>
              ) : (
                <div className={`line-content ${line.stretch < 0 ? 'centered' : ''}`} data-stretch={line.stretch}>
                  {line.parts.map((part, i) => {
                    const key = part.realAya > 0 ? `${part.sura + 1}:${part.realAya}` : null;
                    const active = key !== null && key === currentAyahKey;
                    const saved = key !== null && savedKeys?.has(key);
                    return (
                      <span
                        key={i}
                        className={`quran-part${active ? ' is-active' : ''}${saved ? ' is-saved' : ''}`}
                        data-sura={part.sura}
                        data-aya={part.aya}
                        data-real-aya={part.realAya}
                        onClick={key ? () => onSelectAyah(key) : undefined}
                        onMouseEnter={() => hoverAya(part.sura, part.aya, true)}
                        onMouseLeave={() => hoverAya(part.sura, part.aya, false)}
                      >
                        {splitMarkerTokens(part.text).map((seg, j) =>
                          seg.kind === 'text' ? (
                            <span key={j} className="quran-chunk">
                              {seg.value}
                            </span>
                          ) : (
                            <span key={j} className="relative inline-block leading-none">
                              <AyahMarker
                                digits={seg.digits}
                                width={markerW[seg.digits.length] ?? data.fontSize * 2.4}
                              />
                              {active && onToggleBookmark && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[calc(100%+6px)] z-50">
                                  <div className="relative">
                                    <Button
                                      variant="secondary"
                                      size="icon"
                                      className="h-10 w-10 rounded-full shadow-lg border border-border bg-card/95 backdrop-blur hover:bg-muted"
                                      title={saved ? 'إزالة العلامة' : 'إضافة علامة'}
                                      disabled={bookmarkBusy}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleBookmark();
                                      }}
                                    >
                                      {saved ? <BookmarkCheck className="h-5 w-5 text-primary" /> : <Bookmark className="h-5 w-5" />}
                                    </Button>
                                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 border-x-[6px] border-x-transparent border-t-[6px] border-t-card drop-shadow-sm" />
                                  </div>
                                </div>
                              )}
                            </span>
                          ),
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
