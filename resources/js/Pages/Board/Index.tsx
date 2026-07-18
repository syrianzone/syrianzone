import { useState } from 'react';
import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { BoardGrid, useBreakpoint } from './_components/BoardGrid';
import { activeDashboard, removeWidget, updateWidgetConfig } from './_lib/layout';
import { defaultDoc } from './_lib/registry';
import type { BoardDoc } from './_lib/types';

// Index owns the document and passes it down, matching Places/Index.tsx.
// No zustand: one page, one owner.
export default function Index() {
  const [doc, setDoc] = useState<BoardDoc>(() => defaultDoc());
  const breakpoint = useBreakpoint();
  const dashboard = activeDashboard(doc);

  return (
    <MainLayout>
      <Head title="لوحتي" />
      <main dir="rtl" className="mx-auto w-full max-w-7xl px-3 py-4">
        <h1 className="mb-3 text-lg font-semibold text-foreground">{dashboard.name}</h1>

        <BoardGrid
          widgets={dashboard.widgets}
          breakpoint={breakpoint}
          editing={false}
          onRemove={(id) => setDoc((d) => removeWidget(d, id))}
          onConfigChange={(id, patch) => setDoc((d) => updateWidgetConfig(d, id, patch))}
        />
      </main>
    </MainLayout>
  );
}
