import { Check, CloudOff, Pencil, Plus } from 'lucide-react';
import { Button } from '@/Components/ui/button';

export function BoardToolbar(props: {
  title: string;
  editing: boolean;
  unsaved: boolean;
  onRetry: () => void;
  onToggleEditing: () => void;
  onAddWidget: () => void;
}) {
  return (
    <div dir="rtl" className="mb-3 flex items-center gap-2">
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">{props.title}</h1>

      {/* a failed save is non-fatal: localStorage already has the document, so
          this is a quiet badge rather than a modal */}
      {props.unsaved && (
        <button
          type="button"
          onClick={props.onRetry}
          className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <CloudOff className="h-3.5 w-3.5" />
          غير محفوظ
        </button>
      )}

      {props.editing && (
        <Button type="button" variant="outline" size="sm" onClick={props.onAddWidget}>
          <Plus className="ms-1 h-4 w-4" />
          إضافة
        </Button>
      )}

      <Button
        type="button"
        variant={props.editing ? 'default' : 'outline'}
        size="sm"
        onClick={props.onToggleEditing}
      >
        {props.editing ? <Check className="ms-1 h-4 w-4" /> : <Pencil className="ms-1 h-4 w-4" />}
        {props.editing ? 'تم' : 'تخصيص'}
      </Button>
    </div>
  );
}
