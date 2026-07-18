import { HelpCircle } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { WidgetShell } from './WidgetShell';

// A widget id this build does not know about. It renders as a placeholder and
// the instance is kept in the document untouched, so a board edited on a newer
// client survives a round-trip through an older one.
export function MissingWidget(props: { definitionId: string; editing: boolean; onRemove: () => void }) {
  return (
    <WidgetShell title="ويدجت غير معروف" icon={HelpCircle}>
      <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
        <p className="text-sm text-muted-foreground">
          هذا الويدجت غير متوفر في هذه النسخة
        </p>
        <p dir="ltr" className="font-mono text-xs text-muted-foreground">{props.definitionId}</p>
        {props.editing && (
          <Button type="button" variant="outline" size="sm" onClick={props.onRemove}>
            حذف
          </Button>
        )}
      </div>
    </WidgetShell>
  );
}
