import { useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Alert, AlertDescription } from '@/Components/ui/alert';
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
  // The server has no localStorage, so the first render (server and hydrating
  // client alike) is the default board; the stored one is adopted after mount.
  // Reading storage during render would make the client's first render differ
  // from the server HTML.
  const [doc, setDoc] = useState<BoardDoc>(() => defaultDoc());
  // set from the same read, before the write effect below seeds storage, so
  // sync can tell "guest had a board" from "nothing here yet"
  const [hadLocal, setHadLocal] = useState(false);
  // until storage has been read, nothing may be written back: the default
  // document would overwrite the visitor's board
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const breakpoint = useBreakpoint();
  // straight from the shared Inertia props, not useAuth(): AuthProvider lives
  // inside MainLayout, which this component renders, so the context is not
  // available up here
  const user = (usePage().props.auth as { user?: { id: number } } | undefined)?.user ?? null;
  const dashboard = activeDashboard(doc);

  useEffect(() => {
    const stored = readLocal();
    // migrate() never throws, so a corrupt or newer-version entry falls back to
    // defaults instead of white-screening the page.
    if (stored !== null) setDoc(migrate(stored, defaultDoc()));
    setHadLocal(stored !== null);
    setLoaded(true);
  }, []);

  const sync = useBoardSync({ enabled: !!user && loaded, hadLocal, doc, onAdopt: setDoc });

  // Widgets debounce their edits and flush the last one when they unmount.
  // When the whole page unmounts (an Inertia visit away), that flush arrives
  // after this component's own cleanup: React runs a deleted tree's effect
  // cleanups parent first. A state update then would never be persisted, so
  // the change is applied to the latest document, written to local storage,
  // and staged for the one final server save the sync hook sends.
  const docRef = useRef(doc);
  docRef.current = doc;
  const leaving = useRef(false);
  useEffect(() => () => { leaving.current = true; }, []);

  function changeConfig(id: string, patch: Record<string, unknown>) {
    if (!leaving.current) {
      setDoc((d) => updateWidgetConfig(d, id, patch));
      return;
    }
    const next = updateWidgetConfig(docRef.current, id, patch);
    if (next === docRef.current) return;
    docRef.current = next;
    if (loaded) writeLocal(next);
    sync.stageFinal(next);
  }

  // Effect rather than a write inside the state updater: updaters can run twice
  // under StrictMode, effects settle once per committed document.
  useEffect(() => {
    if (loaded) writeLocal(doc);
  }, [doc, loaded]);

  const configured = dashboard.widgets.find((w) => w.i === configuring) ?? null;

  return (
    <MainLayout>
      
      <div dir="rtl" className="mx-auto w-full max-w-7xl px-3 py-4">
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
            onConfigChange={changeConfig}
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
          onChange={(patch) => configured && changeConfig(configured.i, patch)}
          onClose={() => setConfiguring(null)}
        />
      </div>
    </MainLayout>
  );
}
