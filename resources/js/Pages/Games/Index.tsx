import MainLayout from '@/Layouts/MainLayout';
import { GamesIcon } from '@/Components/Icons/ProjectIcons';
import { GameTileGrid } from '@/Domain/games/GameTile';

export default function Index() {
  return (
    <MainLayout>
      

      {/* The navbar is non-sticky here, so the page is only as tall as the
          navbar plus this block — it scrolls only when the games do not fit. */}
      <div className="min-h-[calc(100svh-var(--sz-navbar-h))] bg-background text-foreground" dir="rtl">
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
          <GameTileGrid className="grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9" />
        </div>
      </div>
    </MainLayout>
  );
}
