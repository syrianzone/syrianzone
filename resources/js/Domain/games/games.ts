import type React from 'react';
import {
  Game2048Icon,
  GuessWhoIcon,
  PresidentIcon,
  SolitaireIcon,
  TarneebIcon,
  TrixIcon,
} from '@/Components/Icons/ProjectIcons';
import raw from '../../../data/games.json';

// Single registry for the hub. The slug, title and link flags live in
// resources/data/games.json (PHP reads the same file for the sitemap), and the
// icon is attached here because a React component cannot live in JSON. A game
// becomes reachable by adding one entry there and a matching route in
// routes/web.php — the tile grid, the sitemap and the 404 page all read this
// list rather than restating the games.

export interface GameEntry {
  /** URL segment under /games (also the React key). */
  slug: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Where the hub card links; defaults to `/games/<slug>`. */
  href?: string;
  /** Play with someone else over the network, not a solo board. */
  online?: boolean;
  /** Hosted elsewhere: the card opens it in a new tab and is not ours to route. */
  external?: boolean;
  /** Not yet playable — the card stays visible but routes nowhere. */
  comingSoon?: boolean;
}

const GAME_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '2048': Game2048Icon,
  solitare: SolitaireIcon,
  tarneeb: TarneebIcon,
  trix: TrixIcon,
  guesswho: GuessWhoIcon,
  president: PresidentIcon,
};

function toGameEntry(game: (typeof raw)[number]): GameEntry {
  const icon = GAME_ICONS[game.slug];
  if (!icon) {
    throw new Error(`A game in resources/data/games.json has no icon: ${game.slug}`);
  }

  return {
    slug: game.slug,
    title: game.title,
    icon,
    ...('href' in game ? { href: game.href } : {}),
    ...('online' in game ? { online: game.online } : {}),
    ...('external' in game ? { external: game.external } : {}),
    ...('comingSoon' in game ? { comingSoon: game.comingSoon } : {}),
  };
}

export const GAMES: GameEntry[] = raw.map(toGameEntry);

/** The link a hub card points at, honouring a game's own home when it has one. */
export function gameEntryHref(game: GameEntry): string {
  return game.href ?? `/games/${game.slug}`;
}

/**
 * The registry entry a game page renders its chrome from. Every `/games/<slug>`
 * page has one; a page that forgets to register throws here rather than
 * rendering chrome that does not match the hub.
 */
export function gameBySlug(slug: string): GameEntry {
  const game = GAMES.find((entry) => entry.slug === slug);
  if (!game) throw new Error(`Unregistered game page: ${slug}`);
  return game;
}
