import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { Lock } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Card, CardContent } from '@/Components/ui/card';
import { GamesIcon } from '@/Components/Icons/ProjectIcons';
import { GAMES, gameHref } from './_lib/games';

function CardBody({ game }: { game: (typeof GAMES)[number] }) {
  return (
    <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
      <game.icon className="h-10 w-10" />
      <span className="text-xs font-bold sm:text-sm">{game.title}</span>
      <span className="text-[11px] leading-snug text-muted-foreground">{game.tagline}</span>
      {game.comingSoon && (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          <Lock className="h-3 w-3" />
          قريباً
        </span>
      )}
    </CardContent>
  );
}

export default function Index() {
  return (
    <MainLayout>
      <Head>
        <title>الألعاب | Syrian Zone</title>
        <meta
          name="description"
          content="ألعاب Syrian Zone: 2048 وسوليتير وألعاب عربية أخرى — تعمل دون اتصال ودون تثبيت."
        />
        <meta property="og:title" content="الألعاب | Syrian Zone" />
        <meta
          property="og:description"
          content="ألعاب بسيطة تلعبها من المتصفح مباشرة، بدون تحميل ولا تسجيل."
        />
      </Head>

      <div className="min-h-svh bg-background text-foreground" dir="rtl">
        <div className="container mx-auto max-w-3xl px-4 py-6">
          <div className="mb-6 text-center">
            <GamesIcon className="mx-auto mb-2 h-12 w-12" />
            <h1 className="mb-1 text-2xl font-bold md:text-3xl">الألعاب</h1>
            <p className="text-sm text-muted-foreground">ألعاب تلعبها في المتصفح مباشرة، دون تحميل</p>
          </div>

          {/* App-grid: icon above, title under — the same rhythm as the Muslim
              Corner tool grid, but each card is a real link to its own URL.
              A wrapping flex rather than a fixed 3-column grid, so the row stays
              centred whether the section holds two games or nine. Unreleased
              games render inert rather than linking to a 404. */}
          <div className="flex flex-wrap justify-center gap-3">
            {GAMES.map((game) =>
              game.comingSoon ? (
                <Card key={game.slug} aria-disabled className="w-[calc(50%-0.375rem)] rounded-2xl opacity-60 sm:w-52">
                  <CardBody game={game} />
                </Card>
              ) : (
                <Link
                  key={game.slug}
                  href={gameHref(game.slug)}
                  className="w-[calc(50%-0.375rem)] no-underline transition-colors hover:bg-accent/40 focus-visible:outline-none sm:w-52"
                >
                  <Card className="h-full cursor-pointer rounded-2xl transition-colors hover:border-primary/50">
                    <CardBody game={game} />
                  </Card>
                </Link>
              ),
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
