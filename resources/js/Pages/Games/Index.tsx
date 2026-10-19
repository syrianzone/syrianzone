import React from 'react';
import { Link } from '@inertiajs/react';
import { ExternalLink, Lock, Users } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { GamesIcon } from '@/Components/Icons/ProjectIcons';
import { GAMES, gameEntryHref, type GameEntry } from './_lib/games';

// A game tile: icon over title, no box — the homepage's app-tile shape. Status
// badges sit under the title.
function GameTile({ game }: { game: GameEntry }) {
  const Icon = game.icon;
  return (
    <>
      <Icon className="h-12 w-12 shrink-0 text-foreground transition-all group-hover:scale-110 group-hover:text-primary" />
      <span className="text-xs font-medium text-foreground transition-colors group-hover:text-primary">
        {game.title}
      </span>
      {/* A coming-soon tile shows one badge only: "قريباً" is the state, and
          "لعب مع صديق" would advertise a game nobody can start. */}
      {game.online && !game.comingSoon && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          <Users className="h-3 w-3" />
          لعب مع صديق
        </span>
      )}
      {game.external && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          موقع خارجي
        </span>
      )}
      {game.comingSoon && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          <Lock className="h-3 w-3" />
          قريباً
        </span>
      )}
    </>
  );
}

const TILE = 'group flex flex-col items-center gap-2 py-1 text-center no-underline';

export default function Index() {
  return (
    <MainLayout>
      

      {/* The navbar is non-sticky here, so the page is only as tall as the
          navbar plus this block — it scrolls only when the games do not fit. */}
      <div className="min-h-[calc(100svh-4rem-1px)] bg-background text-foreground" dir="rtl">
        <div className="container mx-auto max-w-6xl px-4 py-6">
          <div className="mb-6 text-center">
            <GamesIcon className="mx-auto mb-2 h-12 w-12" />
            <h1 className="mb-1 text-2xl font-bold md:text-3xl">الألعاب</h1>
            <p className="text-sm text-muted-foreground">ألعاب تلعبها في المتصفح مباشرة، دون تحميل</p>
          </div>

          {/* App-grid: icon above, title under — the same borderless rhythm as
              the homepage and the Muslim Corner tool grid. Each card is a real
              link to its own URL; unreleased games render inert rather than
              linking to a 404. */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-x-2 gap-y-5">
            {GAMES.map((game) =>
              game.comingSoon ? (
                <div key={game.slug} aria-disabled className={`${TILE} opacity-60`}>
                  <GameTile game={game} />
                </div>
              ) : game.external ? (
                // Ours to link, not to route: a plain anchor, in a new tab.
                <a
                  key={game.slug}
                  href={gameEntryHref(game)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={TILE}
                >
                  <GameTile game={game} />
                </a>
              ) : (
                <Link key={game.slug} href={gameEntryHref(game)} className={TILE}>
                  <GameTile game={game} />
                </Link>
              ),
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
