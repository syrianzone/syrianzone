import { Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/Components/ui/sheet';
import { Button } from '@/Components/ui/button';
import { GALLERY_CATEGORIES, WIDGETS } from '../_lib/registry';
import type { WidgetDeclaration } from '../_lib/types';

// The "marketplace": a browsable view over the in-repo registry. A new widget
// appears here by existing, with no change to this file: the sections are the
// categories the declarations use.
export function WidgetGallery(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placedIds: string[];
  onAdd: (def: WidgetDeclaration) => void;
}) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
        <div dir="rtl">
          <SheetHeader className="text-right">
            <SheetTitle>إضافة ويدجت</SheetTitle>
            <SheetDescription>اختر ما تريد إضافته إلى لوحتك</SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-5">
            {GALLERY_CATEGORIES.map((category) => (
              <section key={category.id}>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{category.label}</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {WIDGETS.filter((w) => w.category === category.id).map((def) => {
                    const placed = props.placedIds.includes(def.id);
                    const disabled = placed && !def.multiple;
                    const Icon = def.icon;

                    return (
                      <div
                        key={def.id}
                        className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                      >
                        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{def.name}</p>
                          <p className="text-xs text-muted-foreground">{def.description}</p>
                          {def.requires.includes('auth') && (
                            <p className="mt-1 text-xs text-muted-foreground">يتطلب تسجيل الدخول</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={disabled}
                          onClick={() => props.onAdd(def)}
                        >
                          <Plus className="h-4 w-4" />
                          {disabled ? 'مضاف' : 'إضافة'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
