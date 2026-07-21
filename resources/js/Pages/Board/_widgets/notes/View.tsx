import { useEffect, useRef, useState } from 'react';
import { StickyNote } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import type { WidgetProps } from '../../_lib/types';
import type { NotesConfig } from './index';

// The document is capped at 64KB server-side and a board may hold 40 widgets,
// so a single note gets a sane slice of that budget.
const MAX_LENGTH = 4000;

// No query: the note lives in the layout config, so it syncs to the server for
// free. Plain text only, rendered in a textarea. Never markdown, never
// dangerouslySetInnerHTML: this is user content we render back.
export default function NotesView({ config, onConfigChange }: WidgetProps<NotesConfig>) {
  const [text, setText] = useState(config.text ?? '');
  const timer = useRef<number | null>(null);

  // adopt external changes (a server document arriving after a login merge)
  // without clobbering what is being typed right now
  useEffect(() => {
    if (timer.current === null) setText(config.text ?? '');
  }, [config.text]);

  // debounced so a keystroke does not churn the whole document
  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function handleChange(value: string) {
    setText(value);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onConfigChange({ text: value });
    }, 400);
  }

  return (
    <WidgetShell title="ملاحظات" icon={StickyNote} scroll={false}>
      <textarea
        dir="rtl"
        value={text}
        maxLength={MAX_LENGTH}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="اكتب ملاحظاتك هنا"
        className="h-full w-full resize-none bg-transparent p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </WidgetShell>
  );
}
