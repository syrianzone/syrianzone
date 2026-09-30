import type React from 'react';
import { Game2048Icon, SolitaireIcon, TarneebIcon } from '@/Components/Icons/ProjectIcons';

// Single registry for the hub. A game becomes reachable by adding one entry
// here and a matching route in routes/web.php — the card grid, the sitemap
// entry and the docs all read this list rather than restating the games.
export interface GameEntry {
  /** URL segment under /games. */
  slug: string;
  title: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Not yet playable — the card stays visible but routes nowhere. */
  comingSoon?: boolean;
}

export const GAMES: GameEntry[] = [
  {
    slug: '2048',
    title: '2048',
    tagline: 'ادمج الأرقام حتى تصل إلى 2048',
    icon: Game2048Icon,
  },
  {
    slug: 'solitare',
    title: 'سوليتير',
    tagline: 'رتّب الأعمدة من ٢ إلى ١٣',
    icon: SolitaireIcon,
  },
  {
    slug: 'tarneeb',
    title: 'طرنيب',
    tagline: 'زايد من ٧ إلى ١٣ واجمع الطرانيب حتى ٤١',
    icon: TarneebIcon,
  },
];

export function gameHref(slug: string): string {
  return `/games/${slug}`;
}
