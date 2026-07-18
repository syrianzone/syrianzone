import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/Components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ConfigField, WidgetDefinition } from '../_lib/types';

// Renders whatever a widget declares in `fields`. No widget ships its own
// settings UI, so a configurable widget needs zero core changes.
export function WidgetConfigDialog(props: {
  def: WidgetDefinition | null;
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const def = props.def;

  return (
    <Dialog open={!!def} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <div dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>{def ? `إعدادات ${def.name}` : 'إعدادات'}</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {def?.fields.map((field) => (
              <Field
                key={field.key}
                field={field}
                value={props.config[field.key] ?? field.default}
                onChange={(value) => props.onChange({ [field.key]: value })}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field(props: { field: ConfigField; value: unknown; onChange: (value: unknown) => void }) {
  const { field } = props;
  const id = `cfg-${field.key}`;

  if (field.type === 'switch') {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{field.label}</Label>
        <Switch id={id} checked={!!props.value} onCheckedChange={props.onChange} />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{field.label}</Label>
        <Select value={String(props.value)} onValueChange={props.onChange}>
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{field.label}</Label>
        <Input
          id={id}
          type="number"
          dir="ltr"
          min={field.min}
          max={field.max}
          value={String(props.value)}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) props.onChange(n);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        maxLength={field.maxLength}
        value={String(props.value)}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
