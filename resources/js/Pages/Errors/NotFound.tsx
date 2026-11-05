import React, { useMemo, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import {
    ArrowRight,
    ExternalLink,
    Home,
    Lock,
    Search,
    Shuffle,
    Users,
} from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { SITE_LINKS } from '@/Lib/siteLinks';
import {
    GamesIcon,
    MuslimIcon,
    RoznamaIcon,
    TransitIcon,
} from '@/Components/Icons/ProjectIcons';
import PlayingCard from '@/Pages/Games/_components/PlayingCard';
import { GAMES, gameEntryHref, type GameEntry } from '@/Pages/Games/_lib/games';
import AyahMark from '@/Pages/Muslim/_components/ayah-mark/AyahMark';
import { TOOLS, toolHref } from '@/Pages/Muslim/_lib/tools';
import CityGrid from '@/Pages/Transit/_components/landing/CityGrid';

export type NotFoundSection = 'general' | 'transit' | 'games' | 'muslim';

interface NotFoundProps {
    status?: number;
    path?: string;
    section?: NotFoundSection;
}

function detectSectionFromPath(path: string): NotFoundSection {
    const clean = path.replace(/^\/+/, '').toLowerCase();
    if (clean === 'muslim' || clean.startsWith('muslim/')) return 'muslim';
    if (
        clean === 'games' ||
        clean.startsWith('games/') ||
        clean === 'guesswho' ||
        clean.startsWith('guesswho/')
    ) {
        return 'games';
    }
    if (
        clean === 'transit' ||
        clean.startsWith('transit/') ||
        clean === 'mishwar' ||
        clean.startsWith('mishwar/') ||
        clean === 'crossings' ||
        clean.startsWith('crossings/') ||
        clean === 'places' ||
        clean.startsWith('places/')
    ) {
        return 'transit';
    }
    return 'general';
}

const TILE_CLASS = 'group flex flex-col items-center gap-2 py-1 text-center no-underline';

function GameTile({ game }: { game: GameEntry }) {
    const Icon = game.icon;
    return (
        <>
            <Icon className="h-12 w-12 shrink-0 text-foreground transition-all group-hover:scale-110 group-hover:text-primary" />
            <span className="text-xs font-medium text-foreground transition-colors group-hover:text-primary">
                {game.title}
            </span>
            {/* Same rule as the hub: a coming-soon tile carries only "قريباً". */}
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

export default function NotFound({ path = '/404', section }: NotFoundProps) {
    const resolvedSection: NotFoundSection = useMemo(() => {
        if (typeof window !== 'undefined') {
            const overrideSec = new URLSearchParams(window.location.search).get('section');
            if (
                overrideSec === 'general' ||
                overrideSec === 'transit' ||
                overrideSec === 'games' ||
                overrideSec === 'muslim'
            ) {
                return overrideSec;
            }
        }
        return section ?? detectSectionFromPath(path);
    }, [path, section]);

    const goBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            window.history.back();
        } else {
            router.visit('/');
        }
    };

    return (
        <MainLayout>
            <div
                className="min-h-[calc(100svh-4rem-1px)] bg-background text-foreground"
                dir="rtl"
            >
                {resolvedSection === 'muslim' && <MuslimNotFound path={path} onBack={goBack} />}
                {resolvedSection === 'transit' && <TransitNotFound path={path} onBack={goBack} />}
                {resolvedSection === 'games' && <GamesNotFound path={path} onBack={goBack} />}
                {resolvedSection === 'general' && <GeneralNotFound path={path} onBack={goBack} />}
            </div>
        </MainLayout>
    );
}

/* ============================================================================
   1. MUSLIM CORNER (`/muslim/*`) — Option A (Ultra-Minimal)
   ============================================================================ */
function MuslimNotFound({ path, onBack }: { path: string; onBack: () => void }) {
    return (
        <div className="container mx-auto max-w-3xl px-4 py-10">
            <div className="mb-6 flex flex-col items-center text-center">
                <div className="mb-2 text-primary">
                    <AyahMark digits="٤٠٤" width={68} />
                </div>
                <h1 className="mb-1 text-2xl font-bold md:text-3xl">الصفحة غير موجودة</h1>
                <p className="text-sm text-muted-foreground">
                    لم نعثر على المسار{' '}
                    <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                        {path}
                    </code>{' '}
                    في الركن الإسلامي
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                    <Button asChild className="gap-2">
                        <Link href="/muslim">
                            <MuslimIcon className="h-4 w-4" />
                            الركن الإسلامي
                        </Link>
                    </Button>
                    <Button type="button" variant="outline" onClick={onBack} className="gap-2">
                        <ArrowRight className="h-4 w-4" />
                        رجوع
                    </Button>
                </div>
            </div>

            <div className="mt-8 border-t border-border/60 pt-6">
                <p className="mb-4 text-center text-xs font-medium text-muted-foreground">
                    أدوات الركن الإسلامي
                </p>
                <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
                    {TOOLS.map((t) => (
                        <Link key={t.slug} href={toolHref(t.slug)} className={TILE_CLASS}>
                            <t.icon className="h-12 w-12 shrink-0 text-foreground transition-all group-hover:scale-110 group-hover:text-primary" />
                            <span className="text-xs font-medium text-foreground transition-colors group-hover:text-primary">
                                {t.title}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ============================================================================
   2. GAMES (`/games/*`, `/guesswho/*`) — PlayingCard 4-0-4 + Randomizer
   ============================================================================ */
function GamesNotFound({ path, onBack }: { path: string; onBack: () => void }) {
    const playableGames = useMemo(
        () => GAMES.filter((g) => !g.comingSoon && !g.external),
        [],
    );
    const [flipped, setFlipped] = useState(true);
    const [pickedIndex, setPickedIndex] = useState(0);

    const pickedGame = playableGames[pickedIndex % playableGames.length] ?? GAMES[0];
    const PickedIcon = pickedGame.icon;

    const dealRandomGame = () => {
        setFlipped(true);
        setPickedIndex((prev) => {
            if (playableGames.length <= 1) return 0;
            const step = 1 + Math.floor(Math.random() * (playableGames.length - 1));
            return (prev + step) % playableGames.length;
        });
    };

    return (
        <div className="container mx-auto max-w-4xl px-4 py-10">
            <div className="mb-6 flex flex-col items-center text-center">
                {/* 3-Card Hand: 4♠ — Middle Randomizer Card (0) — 4♥ */}
                <div
                    dir="ltr"
                    className="mb-6 flex items-center justify-center gap-3 sm:gap-5 select-none"
                    style={{ '--sz-card-w': '6.5rem' } as React.CSSProperties}
                >
                    <div className="w-[var(--sz-card-w)] -rotate-6 transition-transform hover:-translate-y-1">
                        <PlayingCard
                            card={{ id: '4s', suit: 'spades', rank: 4, faceUp: true }}
                            decorative
                            large
                        />
                    </div>

                    {/* Middle Card: Interactive 0 / Random Game Card using standard .sz-card */}
                    <button
                        type="button"
                        onClick={() => (flipped ? dealRandomGame() : setFlipped(true))}
                        aria-label="اسحب لعبة عشوائية"
                        className={`w-[var(--sz-card-w)] -translate-y-1.5 cursor-pointer transition-transform hover:-translate-y-2.5 ${
                            flipped
                                ? 'sz-card sz-card--face sz-card--picked'
                                : 'sz-card sz-card--back'
                        }`}
                    >
                        {flipped ? (
                            <span dir="rtl" className="contents">
                                <span className="sz-card__corner text-primary">
                                    0
                                    <span className="sz-card__corner-suit">★</span>
                                </span>
                                <span className="flex flex-col items-center justify-center gap-1.5 px-1.5 pt-2 text-center">
                                    <PickedIcon className="h-9 w-9 shrink-0" />
                                    <span className="text-[11px] font-extrabold leading-tight text-slate-900">
                                        {pickedGame.title}
                                    </span>
                                </span>
                            </span>
                        ) : null}
                    </button>

                    <div className="w-[var(--sz-card-w)] rotate-6 transition-transform hover:-translate-y-1">
                        <PlayingCard
                            card={{ id: '4h', suit: 'hearts', rank: 4, faceUp: true }}
                            decorative
                            large
                        />
                    </div>
                </div>

                <h1 className="mb-1 text-2xl font-bold md:text-3xl">هذه الورقة خارج اللعبة</h1>
                <p className="text-sm text-muted-foreground">
                    لم نعثر على المسار{' '}
                    <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                        {path}
                    </code>{' '}
                    ضمن الألعاب
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                    <Button asChild className="gap-2">
                        <Link href={gameEntryHref(pickedGame)}>
                            <PickedIcon className="h-4 w-4" />
                            العب «{pickedGame.title}»
                        </Link>
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={dealRandomGame}
                        className="gap-2"
                    >
                        <Shuffle className="h-4 w-4" />
                        اسحب ورقة عشوائية
                    </Button>
                    <Button asChild variant="outline" className="gap-2">
                        <Link href="/games">
                            <GamesIcon className="h-4 w-4" />
                            صالة الألعاب
                        </Link>
                    </Button>
                    <Button type="button" variant="ghost" onClick={onBack} className="gap-2">
                        <ArrowRight className="h-4 w-4" />
                        رجوع
                    </Button>
                </div>
            </div>

            {/* Exact borderless game tile grid from Games/Index.tsx */}
            <div className="mt-8 border-t border-border/60 pt-6">
                <p className="mb-4 text-center text-xs font-medium text-muted-foreground">
                    الألعاب المتاحة
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-x-2 gap-y-5">
                    {GAMES.map((game) =>
                        game.comingSoon ? (
                            <div key={game.slug} aria-disabled className={`${TILE_CLASS} opacity-60`}>
                                <GameTile game={game} />
                            </div>
                        ) : game.external ? (
                            <a
                                key={game.slug}
                                href={gameEntryHref(game)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={TILE_CLASS}
                            >
                                <GameTile game={game} />
                            </a>
                        ) : (
                            <Link key={game.slug} href={gameEntryHref(game)} className={TILE_CLASS}>
                                <GameTile game={game} />
                            </Link>
                        ),
                    )}
                </div>
            </div>
        </div>
    );
}

/* ============================================================================
   3. TRANSIT (`/transit/*`, `/mishwar/*`, `/crossings/*`, `/places/*`)
      Route line motif + full CityGrid list of all cities
   ============================================================================ */
function TransitNotFound({ path, onBack }: { path: string; onBack: () => void }) {
    return (
        <div className="mx-auto max-w-7xl px-4 pt-10">
            <div className="mx-auto max-w-3xl flex flex-col items-center text-center">
                <TransitIcon className="mb-2 h-12 w-12" />
                <h1 className="mb-1 text-2xl font-bold md:text-3xl">هذا السرفيس لا يمرّ من هنا!</h1>
                <p className="text-sm text-muted-foreground">
                    المسار{' '}
                    <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                        {path}
                    </code>{' '}
                    غير مسجّل على خارطة المواصلات والأماكن
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                    <Button asChild className="gap-2">
                        <Link href="/transit">
                            <TransitIcon className="h-4 w-4" />
                            ترانزيت سوريا
                        </Link>
                    </Button>
                    <Button asChild variant="secondary" className="gap-2">
                        <Link href="/mishwar">دليل مشوار</Link>
                    </Button>
                    <Button type="button" variant="outline" onClick={onBack} className="gap-2">
                        <ArrowRight className="h-4 w-4" />
                        رجوع
                    </Button>
                </div>

                {/* Route Line Motif */}
                <div className="mt-7 w-full overflow-hidden rounded-xl border border-border bg-card p-4">
                    <svg viewBox="0 0 680 130" className="w-full h-auto" role="img" aria-label="مخطط مسار الخط 404">
                        <line
                            x1="620"
                            y1="50"
                            x2="250"
                            y2="50"
                            stroke="hsl(var(--primary))"
                            strokeWidth="6"
                            strokeLinecap="round"
                        />
                        <path
                            d="M 250 50 Q 170 50 140 90 L 70 90"
                            fill="none"
                            stroke="hsl(var(--destructive))"
                            strokeWidth="5"
                            strokeDasharray="10 8"
                            strokeLinecap="round"
                        />
                        <line
                            x1="250"
                            y1="50"
                            x2="60"
                            y2="50"
                            stroke="hsl(var(--border))"
                            strokeWidth="4"
                            strokeLinecap="round"
                        />

                        {[
                            { x: 610, label: 'دمشق', sub: 'الرئيسية' },
                            { x: 490, label: 'حمص', sub: 'الروزنامة' },
                            { x: 370, label: 'حماة', sub: 'مشوار' },
                            { x: 250, label: 'حلب', sub: 'ترانزيت' },
                        ].map((st) => (
                            <g key={st.label}>
                                <circle
                                    cx={st.x}
                                    cy="50"
                                    r="9"
                                    fill="hsl(var(--card))"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth="4"
                                />
                                <text
                                    x={st.x}
                                    y="25"
                                    textAnchor="middle"
                                    className="fill-foreground text-[13px] font-bold"
                                >
                                    {st.label}
                                </text>
                                <text
                                    x={st.x}
                                    y="78"
                                    textAnchor="middle"
                                    className="fill-muted-foreground text-[11px]"
                                >
                                    {st.sub}
                                </text>
                            </g>
                        ))}

                        <g>
                            <circle cx="75" cy="90" r="13" fill="hsl(var(--destructive))" />
                            <text
                                x="75"
                                y="94"
                                textAnchor="middle"
                                className="fill-white text-[11px] font-black"
                            >
                                404
                            </text>
                            <text
                                x="75"
                                y="120"
                                textAnchor="middle"
                                className="fill-foreground text-[12px] font-bold"
                            >
                                محطة مفقودة
                            </text>
                        </g>
                    </svg>
                </div>
            </div>

            {/* Full list of all cities using the standard CityGrid component */}
            <CityGrid />
        </div>
    );
}

/* ============================================================================
   4. GENERAL (`/*`) — Option B (Standard Input Filter + Full Borderless App Grid)
   ============================================================================ */
function GeneralNotFound({ path, onBack }: { path: string; onBack: () => void }) {
    const [query, setQuery] = useState('');

    const internalTools = useMemo(
        () => SITE_LINKS.filter((l) => l.isInternal && !l.external),
        [],
    );

    const displayedTools = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return internalTools;
        return internalTools.filter(
            (item) =>
                item.text.toLowerCase().includes(q) ||
                item.href.toLowerCase().includes(q),
        );
    }, [internalTools, query]);

    return (
        <div className="container mx-auto max-w-5xl px-4 py-10">
            <div className="mb-6 flex flex-col items-center text-center">
                <RoznamaIcon className="mb-2 h-12 w-12" />
                <span className="mb-1 font-mono text-xs font-bold text-primary">404</span>
                <h1 className="mb-1 text-2xl font-bold md:text-3xl">الصفحة غير موجودة</h1>
                <p className="text-sm text-muted-foreground">
                    لم نعثر على المسار{' '}
                    <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                        {path}
                    </code>{' '}
                    في المساحة السورية
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                    <Button asChild className="gap-2">
                        <Link href="/">
                            <Home className="h-4 w-4" />
                            الصفحة الرئيسية
                        </Link>
                    </Button>
                    <Button type="button" variant="outline" onClick={onBack} className="gap-2">
                        <ArrowRight className="h-4 w-4" />
                        رجوع
                    </Button>
                </div>
            </div>

            <div className="mt-8 border-t border-border/60 pt-6">
                <div className="relative mx-auto mb-6 max-w-sm">
                    <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="ابحث في أدوات المساحة السورية..."
                        className="ps-9"
                    />
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-x-2 gap-y-5">
                    {displayedTools.map((tool) => {
                        const Icon = tool.icon;
                        return (
                            <Link key={tool.href} href={tool.href} className={TILE_CLASS}>
                                {Icon && (
                                    <Icon className="h-12 w-12 shrink-0 text-foreground transition-all group-hover:scale-110 group-hover:text-primary" />
                                )}
                                <span className="text-xs font-medium text-foreground transition-colors group-hover:text-primary">
                                    {tool.text}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
