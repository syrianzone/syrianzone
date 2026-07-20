import { useEffect, useRef, useState } from 'react';
import { ListTodo, X } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import type { WidgetProps } from '../../_lib/types';
import type { TodoConfig, TodoItem } from './index';

// The document is capped at 64KB server-side across up to 40 widgets, so one
// list gets a bounded slice of that budget: 50 items of 200 chars is ~10KB
// worst case, in the same order as the notes widget's 4000 char cap.
const MAX_ITEMS = 50;
const MAX_LENGTH = 200;

function readItems(value: unknown): TodoItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is TodoItem => !!v && typeof v === 'object'
      && typeof (v as TodoItem).id === 'string'
      && typeof (v as TodoItem).text === 'string')
    .slice(0, MAX_ITEMS)
    .map((v) => ({ id: v.id, text: v.text.slice(0, MAX_LENGTH), done: v.done === true }));
}

// No query: the list lives in the layout config, so it syncs to the server for
// free. Plain text only, rendered as text nodes. Never markdown, never
// dangerouslySetInnerHTML: this is user content we render back.
export default function TodoView({ config, onConfigChange }: WidgetProps<TodoConfig>) {
  const [items, setItems] = useState(() => readItems(config.items));
  const [draft, setDraft] = useState('');
  const timer = useRef<number | null>(null);

  // adopt external changes (a server document arriving after a login merge)
  // without clobbering an edit that has not been flushed yet
  useEffect(() => {
    if (timer.current === null) setItems(readItems(config.items));
  }, [config.items]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  // debounced so a burst of toggles does not churn the whole document once per
  // click. The draft input is local state and never written until Enter, so
  // typing costs no writes at all.
  function commit(next: TodoItem[]) {
    setItems(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onConfigChange({ items: next });
    }, 400);
  }

  function add() {
    const text = draft.trim().slice(0, MAX_LENGTH);
    if (!text || items.length >= MAX_ITEMS) return;
    setDraft('');
    commit([...items, { id: Math.random().toString(36).slice(2, 8), text, done: false }]);
  }

  function toggle(id: string) {
    commit(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  }

  function remove(id: string) {
    commit(items.filter((it) => it.id !== id));
  }

  const remaining = items.filter((it) => !it.done).length;
  const visible = config.hideCompleted ? items.filter((it) => !it.done) : items;
  const full = items.length >= MAX_ITEMS;

  return (
    <WidgetShell title="مهامي" icon={ListTodo}>
      <div dir="rtl" className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-2 px-3 pt-2">
          <input
            type="text"
            dir="rtl"
            value={draft}
            maxLength={MAX_LENGTH}
            disabled={full}
            aria-label="مهمة جديدة"
            placeholder={full ? 'بلغت الحد الأقصى للمهام' : 'أضف مهمة ثم اضغط Enter'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-50"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            متبقّي <span dir="ltr">{remaining}</span>
          </span>
        </div>

        <ul className="min-h-0 flex-1 overflow-auto p-2">
          {visible.length === 0 && (
            <li className="p-2 text-center text-sm text-muted-foreground">لا توجد مهام</li>
          )}
          {visible.map((it) => (
            <li key={it.id} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-accent/50">
              <input
                type="checkbox"
                id={`todo-${it.id}`}
                checked={it.done}
                onChange={() => toggle(it.id)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              <label
                htmlFor={`todo-${it.id}`}
                className={`min-w-0 flex-1 cursor-pointer break-words text-sm ${it.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}
              >
                {it.text}
              </label>
              <button
                type="button"
                aria-label="حذف المهمة"
                onClick={() => remove(it.id)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </WidgetShell>
  );
}
