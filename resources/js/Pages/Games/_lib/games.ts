import type React from 'react';
import { Game2048Icon, GuessWhoIcon, SolitaireIcon, TarneebIcon } from '@/Components/Icons/ProjectIcons';

// Single registry for the hub. A game becomes reachable by adding one entry
// here and a matching route in routes/web.php — the card grid, the sitemap
// entry and the docs all read this list rather than restating the games.
//
// Most games live at `/games/<slug>`. `href` overrides that for a game that has
// its own home already — Guess Who is the online, multiplayer one, hosted by a
// controller at `/guesswho` rather than a static closure under `/games`.
export interface GameEntry {
  /** URL segment under /games (also the React key). */
  slug: string;
  title: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Where the hub card links; defaults to `/games/<slug>`. */
  href?: string;
  /** Play with someone else over the network, not a solo board. */
  online?: boolean;
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
  {
    slug: 'guesswho',
    title: 'مَنْ هُوَ؟',
    tagline: 'تحدَّ صديقك: اسأل واستبعد حتى تكشف بطله',
    icon: GuessWhoIcon,
    href: '/guesswho',
    online: true,
  },
];

export function gameHref(slug: string): string {
  return `/games/${slug}`;
}

/** The link a hub card points at, honouring a game's own home when it has one. */
export function gameEntryHref(game: GameEntry): string {
  return game.href ?? gameHref(game.slug);
}
