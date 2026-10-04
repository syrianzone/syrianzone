import React from 'react';
import type { Category } from '../data/types';
import { Landmark, Scale, BookOpen, Building2, Flag, Users, Star, type LucideIcon } from 'lucide-react';

// Symbolic, theme-aware avatar for a figure. Uses a real image when available,
// otherwise a category-coloured circle with a role icon or the first letter.
const CATEGORY_COLOR: Record<Category, string> = {
  founder: 'var(--fig-founder)',
  baath: 'var(--fig-baath)',
  islam: 'var(--fig-islam)',
  civ: 'var(--fig-civ)',
  kurd: 'var(--fig-kurd)',
  minority: 'var(--fig-minority)',
  current: 'var(--fig-current)',
};

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  founder: Landmark,
  baath: Flag,
  islam: BookOpen,
  civ: Scale,
  kurd: Star,
  minority: Users,
  current: Building2,
};

interface Props {
  name: string;
  category: Category;
  image?: string;
  size?: number;
}

export default function FigureAvatar({ name, category, image, size = 72 }: Props) {
  const color = CATEGORY_COLOR[category];
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderColor: color,
    background: image ? undefined : 'color-mix(in oklab, ' + color + ' 18%, transparent)',
  };

  return (
    <div
      className="rounded-full overflow-hidden border-2 flex items-center justify-center shrink-0"
      style={style}
      aria-label={name}
    >
      {image ? (
        <img src={image} alt={name} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        (() => {
          const Icon = CATEGORY_ICON[category];
          return <Icon style={{ color }} size={size * 0.45} />;
        })()
      )}
    </div>
  );
}
