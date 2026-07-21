import { useState } from 'react';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { cn } from '@/Lib/utils';
import { Input } from '@/components/ui/input';
import { MAX_DASHBOARDS } from '../_lib/layout';
import type { BoardDoc } from '../_lib/types';

// Tabs are a view over doc.dashboards; there is no separate tab state.
export function DashboardTabs(props: {
  doc: BoardDoc;
  editing: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  function commit() {
    const name = draft.trim();
    if (renaming && name) props.onRename(renaming, name.slice(0, 40));
    setRenaming(null);
  }

  return (
    <div dir="rtl" className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1">
      {props.doc.dashboards.map((d) => {
        const active = d.id === props.doc.activeId;

        if (renaming === d.id) {
          return (
            <span key={d.id} className="flex shrink-0 items-center gap-1">
              <Input
                autoFocus
                value={draft}
                maxLength={40}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit();
                  if (e.key === 'Escape') setRenaming(null);
                }}
                onBlur={commit}
                className="h-8 w-32"
              />
              <button type="button" aria-label="حفظ" onClick={commit} className="rounded p-1 text-muted-foreground hover:text-foreground">
                <Check className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        }

        return (
          <span
            key={d.id}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors',
              active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
            )}
          >
            <button type="button" onClick={() => props.onSelect(d.id)} className="max-w-32 truncate">
              {d.name}
            </button>

            {props.editing && active && (
              <>
                <button
                  type="button"
                  aria-label="إعادة تسمية"
                  onClick={() => { setRenaming(d.id); setDraft(d.name); }}
                  className="opacity-70 hover:opacity-100"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {/* the last dashboard is not removable: the document must always have one */}
                {props.doc.dashboards.length > 1 && (
                  <button
                    type="button"
                    aria-label="حذف اللوحة"
                    onClick={() => props.onRemove(d.id)}
                    className="opacity-70 hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </span>
        );
      })}

      {props.editing && props.doc.dashboards.length < MAX_DASHBOARDS && (
        <button
          type="button"
          aria-label="لوحة جديدة"
          onClick={props.onAdd}
          className="shrink-0 rounded-full border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
