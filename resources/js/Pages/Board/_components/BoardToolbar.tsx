import { Check, Pencil } from 'lucide-react';
import { Button } from '@/Components/ui/button';

export function BoardToolbar(props: {
  title: string;
  editing: boolean;
  onToggleEditing: () => void;
}) {
  return (
    <div dir="rtl" className="mb-3 flex items-center gap-2">
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">{props.title}</h1>

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
