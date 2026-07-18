import { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/Components/ui/button';
import { BoardGrid, useBreakpoint } from './_components/BoardGrid';
import { BoardToolbar } from './_components/BoardToolbar';
import { activeDashboard, migrate, moveWidget, removeWidget, resizeWidget, updateWidgetConfig } from './_lib/layout';
import { defaultDoc } from './_lib/registry';
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

  return (
    <MainLayout>
      <Head title="لوحتي" />
      <main dir="rtl" className="mx-auto w-full max-w-7xl px-3 py-4">
        <BoardToolbar
          title={dashboard.name}
          editing={editing}
          unsaved={sync.status === 'error'}
          onRetry={sync.retry}
          onToggleEditing={() => setEditing((e) => !e)}
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

        <BoardGrid
          widgets={dashboard.widgets}
          breakpoint={breakpoint}
          editing={editing}
          onMove={(from, to) => setDoc((d) => moveWidget(d, from, to))}
          onRemove={(id) => setDoc((d) => removeWidget(d, id))}
          onResize={(id, size) => setDoc((d) => resizeWidget(d, id, size))}
          onConfigure={() => undefined}
          onConfigChange={(id, patch) => setDoc((d) => updateWidgetConfig(d, id, patch))}
        />
      </main>
    </MainLayout>
  );
}
