import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { activeLineIndex, parseLrc } from '../_lib/lrc';

interface LyricsViewProps {
  lrc: string | null;
  currentTime: number;
  onSeek?: (t: number) => void;
  className?: string;
  lyricsStatus?: string;
}

export default function LyricsView({ lrc, currentTime, onSeek, className, lyricsStatus }: LyricsViewProps) {
  const lines = useMemo(() => (lrc ? parseLrc(lrc) : []), [lrc]);
  const active = activeLineIndex(lines, currentTime);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);
  // manual scrolling pauses auto-follow; distinguished from our own smooth
  // scrolls by ignoring scroll events for a short window after scrollTo
  const userScrolledAt = useRef(0);
  const autoScrollUntil = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const el = activeRef.current;
    if (!container || !el || active < 0) return;
    if (Date.now() - userScrolledAt.current < 4000) return;
    autoScrollUntil.current = Date.now() + 1000;
    container.scrollTo({
      top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2,
      behavior: 'smooth',
    });
  }, [active]);

  if (lines.length === 0) {
    if (lyricsStatus === 'pending') {
      return (
        <div className={cn('flex animate-pulse items-center justify-center py-10 text-sm text-muted-foreground', className)}>
          جارٍ استخراج كلمات الأغنية تلقائياً…
        </div>
      );
    }
    return (
      <div className={cn('flex items-center justify-center py-10 text-sm text-muted-foreground', className)}>
        لا توجد كلمات لهذه الأغنية
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={() => {
        if (Date.now() > autoScrollUntil.current) userScrolledAt.current = Date.now();
      }}
      className={cn('relative overflow-y-auto', className)}
    >
      <div className="mx-auto flex max-w-lg flex-col gap-0.5 px-4 py-6 text-center">
        {lines.map((line, i) => {
          const isActive = i === active;
          const seekable = line.time !== null && onSeek !== undefined;
          return (
            <div key={i} ref={isActive ? activeRef : undefined}>
              <button
                type="button"
                disabled={!seekable}
                onClick={() => {
                  if (line.time !== null) onSeek?.(line.time);
                }}
                className={cn(
                  'w-full rounded-lg px-3 py-1.5 text-lg font-semibold leading-relaxed transition-colors duration-300',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                  seekable ? 'cursor-pointer hover:bg-accent/50 hover:text-foreground' : 'cursor-default'
                )}
              >
                {line.text}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
