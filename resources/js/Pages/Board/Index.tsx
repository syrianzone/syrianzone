import { useState } from 'react';
import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { BoardGrid, useBreakpoint } from './_components/BoardGrid';
import { BoardToolbar } from './_components/BoardToolbar';
import { activeDashboard, moveWidget, removeWidget, resizeWidget, updateWidgetConfig } from './_lib/layout';
import { defaultDoc } from './_lib/registry';
import type { BoardDoc } from './_lib/types';

// Index owns the document and passes it down, matching Places/Index.tsx.
// No zustand: one page, one owner.
export default function Index() {
  const [doc, setDoc] = useState<BoardDoc>(() => defaultDoc());
  const [editing, setEditing] = useState(false);
  const breakpoint = useBreakpoint();
  const dashboard = activeDashboard(doc);

  return (
    <MainLayout>
      <Head title="لوحتي" />
      <main dir="rtl" className="mx-auto w-full max-w-7xl px-3 py-4">
        <BoardToolbar
          title={dashboard.name}
          editing={editing}
          onToggleEditing={() => setEditing((e) => !e)}
        />

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
