import MainLayout from '@/Layouts/MainLayout';
import { PageBody, PageHeader } from '@/Components/layout';
import { GameTileGrid } from '@/Domain/games/GameTile';

export default function Index() {
  return (
    <MainLayout>
      <div className="min-h-[calc(100svh-var(--sz-navbar-h))] bg-background text-foreground" dir="rtl">
        <PageHeader
          title="الألعاب"
          description="ألعاب تلعبها في المتصفح مباشرة، دون تحميل."
          divider
        />

        <PageBody className="pt-6 space-y-6">

          {/* App-grid: icon above, title under — the same borderless rhythm as
              the homepage and the Muslim Corner tool grid. Each card is a real
              link to its own URL; unreleased games render inert rather than
              linking to a 404. */}
          <GameTileGrid className="grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9" />
        </PageBody>
      </div>
    </MainLayout>
  );
}
