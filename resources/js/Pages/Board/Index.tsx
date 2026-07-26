import { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/Components/ui/button';
import { BoardGrid, useBreakpoint } from './_components/BoardGrid';
import { BoardToolbar } from './_components/BoardToolbar';
import { DashboardTabs } from './_components/DashboardTabs';
import { GeoProvider } from './_components/GeoProvider';
import { WidgetGallery } from './_components/WidgetGallery';
import { WidgetConfigDialog } from './_components/WidgetConfigDialog';
import {
  activeDashboard,
  addDashboard,
  addWidget,
  migrate,
  moveWidget,
  removeDashboard,
  removeWidget,
  renameDashboard,
  resizeWidget,
  selectDashboard,
  updateWidgetConfig,
} from './_lib/layout';
import { defaultDoc, findWidget } from './_lib/registry';
import { readLocal, writeLocal } from './_lib/storage';
import { useBoardSync } from './_lib/sync';
import type { BoardDoc } from './_lib/types';

// Index owns the document and passes it down, matching Places/Index.tsx.
// No zustand: one page, one owner.
export default function Index() {
  // migrate() never throws, so a corrupt or newer-version entry falls back to
  // defaults instead of white-screening the page.
  const [doc, setDoc] = useState<BoardDoc>(() => migrate(readLocal(), defaultDoc()));
  // captured during the first render, before the write effect below seeds
  // storage, so sync can tell "guest had a board" from "nothing here yet"
  const [hadLocal] = useState(() => readLocal() !== null);
  const [editing, setEditing] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const breakpoint = useBreakpoint();
  // straight from the shared Inertia props, not useAuth(): AuthProvider lives
  // inside MainLayout, which this component renders, so the context is not
  // available up here
  const user = (usePage().props.auth as { user?: { id: number } } | undefined)?.user ?? null;
  const dashboard = activeDashboard(doc);

  const sync = useBoardSync({ enabled: !!user, hadLocal, doc, onAdopt: setDoc });

  // Effect rather than a write inside the state updater: updaters can run twice
  // under StrictMode, effects settle once per committed document.
  useEffect(() => {
    writeLocal(doc);
  }, [doc]);

  const configured = dashboard.widgets.find((w) => w.i === configuring) ?? null;

  return (
    <MainLayout>
      <Head>
        <title>لوحتي | لوحة أدواتك اليومية المخصصة في سوريا زون</title>
        <meta
          name="description"
          content="لوحتك الشخصية المخصصة لمتابعة مواقيت الصلاة، الطقس، قائمة المهام، أوقات البومودورو، أحداث اليوم، والقرآن الكريم في مكان واحد."
        />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="لوحتي | لوحة أدواتك اليومية المخصصة في سوريا زون" />
        <meta
          property="og:description"
          content="لوحتك الشخصية المخصصة لمتابعة مواقيت الصلاة، الطقس، قائمة المهام، أوقات البومودورو، أحداث اليوم، والقرآن الكريم في مكان واحد."
        />
      </Head>
      <main dir="rtl" className="mx-auto w-full max-w-7xl px-3 py-4">
        <BoardToolbar
          title={dashboard.name}
          editing={editing}
          unsaved={sync.status === 'error'}
          onRetry={sync.retry}
          onToggleEditing={() => setEditing((e) => !e)}
          onAddWidget={() => setGalleryOpen(true)}
        />

        <DashboardTabs
          doc={doc}
          editing={editing}
          onSelect={(id) => setDoc((d) => selectDashboard(d, id))}
          onAdd={() => setDoc((d) => addDashboard(d, 'لوحة جديدة'))}
          onRename={(id, name) => setDoc((d) => renameDashboard(d, id, name))}
          onRemove={(id) => setDoc((d) => removeDashboard(d, id))}
        />

        {sync.superseded && (
          <Alert className="mb-3">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span className="flex-1">تم استبدال هذه اللوحة بنسخة أحدث من جهاز آخر</span>
              <Button type="button" variant="outline" size="sm" onClick={sync.restore}>
                استعادة النسخة السابقة
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={sync.dismiss}>
                تجاهل
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <GeoProvider>
          <BoardGrid
            widgets={dashboard.widgets}
            breakpoint={breakpoint}
            editing={editing}
            onMove={(from, to) => setDoc((d) => moveWidget(d, from, to))}
            onRemove={(id) => setDoc((d) => removeWidget(d, id))}
            onResize={(id, size) => setDoc((d) => resizeWidget(d, id, size))}
            onConfigure={(id) => setConfiguring(id)}
            onConfigChange={(id, patch) => setDoc((d) => updateWidgetConfig(d, id, patch))}
          />
        </GeoProvider>

        <WidgetGallery
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          placedIds={dashboard.widgets.map((w) => w.d)}
          onAdd={(def) => {
            setDoc((d) => addWidget(d, def));
            setGalleryOpen(false);
          }}
        />

        <WidgetConfigDialog
          def={configured ? findWidget(configured.d) ?? null : null}
          config={configured?.c ?? {}}
          onChange={(patch) => configured && setDoc((d) => updateWidgetConfig(d, configured.i, patch))}
          onClose={() => setConfiguring(null)}
        />
      </main>
    </MainLayout>
  );
}
