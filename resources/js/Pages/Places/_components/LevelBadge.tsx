import type { CSSProperties } from 'react';
import { MapPin, Star } from 'lucide-react';
import { cn } from '@/Lib/utils';

// tier colors are inline styles on purpose: code-split css cascade is unreliable here.
// brand reads --places-level-brand: the plain dark theme keeps --primary at a 36%-lightness
// olive (~3:1 on the near-black card), so app.css overrides the token there; other themes
// fall back to their own legible --primary
const TIER_STYLES: Record<'brand' | 'gold' | 'premium', CSSProperties> = {
  brand: {
    color: 'hsl(var(--places-level-brand, var(--primary)))',
    borderColor: 'hsl(var(--places-level-brand, var(--primary)) / 0.4)',
    backgroundColor: 'hsl(var(--places-level-brand, var(--primary)) / 0.12)',
  },
  gold: {
    color: 'hsl(38 80% 50%)',
    borderColor: 'hsl(38 80% 50% / 0.4)',
    backgroundColor: 'hsl(38 80% 50% / 0.12)',
  },
  premium: {
    color: 'hsl(340 68% 58%)',
    borderColor: 'hsl(340 68% 58% / 0.4)',
    backgroundColor: 'hsl(340 68% 58% / 0.12)',
  },
};

const tierFor = (level: number) => (level >= 8 ? 'premium' : level >= 6 ? 'gold' : 'brand');

// star-number ink per tier: #fff on the gold fill is ~2.2:1, illegible at 7px;
// dark amber ink reaches ~5.3:1 there. white holds on the olive and rose fills
const STAR_INK: Record<'brand' | 'gold' | 'premium', string> = {
  brand: '#fff',
  gold: 'hsl(38 90% 15%)',
  premium: '#fff',
};

export function LevelBadge(props: { level: number; showLabel?: boolean; className?: string }) {
  const { level, showLabel, className } = props;
  if (!Number.isFinite(level) || level < 1) return null;
  const tier = tierFor(level);

  if (level < 3) {
    return (
      <span
        role="img"
        aria-label={`المستوى ${level}`}
        className={cn(
          'inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold tabular-nums text-secondary-foreground',
          className,
        )}
      >
        {level}
      </span>
    );
  }

  return (
    <span
      role="img"
      title="مرشد محلي"
      aria-label={`مرشد محلي، المستوى ${level}`}
      style={TIER_STYLES[tier]}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
        className,
      )}
    >
      <MapPin className="h-3 w-3" aria-hidden />
      {level >= 4 && (
        <span className="relative inline-flex items-center justify-center" aria-hidden>
          <Star className="h-3.5 w-3.5 fill-current" />
          <span className="absolute text-[7px] font-bold leading-none" style={{ color: STAR_INK[tier] }}>
            {level}
          </span>
        </span>
      )}
      {showLabel && <span>مرشد محلي</span>}
    </span>
  );
}
