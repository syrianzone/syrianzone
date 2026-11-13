import { Link } from '@inertiajs/react';
import { ExternalLink, Lock, Users } from 'lucide-react';
import { cn } from '@/Lib/utils';
import { GAMES, gameEntryHref, type GameEntry } from './games';

/** The borderless tile shape the hub and the 404 page share. */
const GAME_TILE_CLASS = 'group flex flex-col items-center gap-2 py-1 text-center no-underline';

/** One game's icon, title and state badges; the caller owns the link or wrapper. */
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

/**
 * The registry as tiles: an unreleased game renders inert rather than linking to
 * a 404, an externally hosted one opens in a new tab, everything else routes.
 * `className` carries the page's column rhythm; the gap and the tile are fixed.
 */
export function GameTileGrid({ games = GAMES, className }: {
    games?: readonly GameEntry[];
    className?: string;
}) {
    return (
        <div className={cn('grid gap-x-2 gap-y-5', className)}>
            {games.map((game) =>
                game.comingSoon ? (
                    <div key={game.slug} aria-disabled className={`${GAME_TILE_CLASS} opacity-60`}>
                        <GameTile game={game} />
                    </div>
                ) : game.external ? (
                    // Ours to link, not to route: a plain anchor, in a new tab.
                    <a
                        key={game.slug}
                        href={gameEntryHref(game)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={GAME_TILE_CLASS}
                    >
                        <GameTile game={game} />
                    </a>
                ) : (
                    <Link key={game.slug} href={gameEntryHref(game)} className={GAME_TILE_CLASS}>
                        <GameTile game={game} />
                    </Link>
                ),
            )}
        </div>
    );
}
