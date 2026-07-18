import { Suspense } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, LogIn, Settings, X } from 'lucide-react';
import { useAuth } from '@/Contexts/AuthContext';
import { Button } from '@/Components/ui/button';
import { findWidget } from '../_lib/registry';
import { spanAt } from '../_lib/layout';
import type { Breakpoint, WidgetInstance, WidgetSize } from '../_lib/types';
import { WidgetShell } from './WidgetShell';
import { MissingWidget } from './MissingWidget';
import { TileChromeProvider } from './TileChrome';
import { SizeMenu } from './SizeMenu';

// Capability gates live here, never inside a widget: a widget body should be
// able to assume it is allowed to run.
export function BoardTile(props: {
  widget: WidgetInstance;
  breakpoint: Breakpoint;
  editing: boolean;
  onRemove: () => void;
  onResize: (size: WidgetSize) => void;
  onConfigure: () => void;
  onConfigChange: (patch: Record<string, unknown>) => void;
}) {
  const { user } = useAuth();
  const def = findWidget(props.widget.d);
  const sortable = useSortable({ id: props.widget.i, disabled: !props.editing });

  const style = {
    gridColumn: `span ${spanAt(props.widget.w, props.breakpoint)}`,
    gridRow: `span ${props.widget.h}`,
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    // the dragged tile rides above its neighbours while they shuffle
    zIndex: sortable.isDragging ? 10 : undefined,
    opacity: sortable.isDragging ? 0.85 : undefined,
  };

  const actions = props.editing ? (
    <div className="flex shrink-0 items-center gap-0.5">
      {def && <SizeMenu def={def} size={{ w: props.widget.w, h: props.widget.h }} onResize={props.onResize} />}
      {def && def.fields.length > 0 && (
        <button
          type="button"
          aria-label="إعدادات"
          onClick={props.onConfigure}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        aria-label="حذف"
        onClick={props.onRemove}
        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {/* the handle is the only drag surface, so scrolling a list widget on
          touch never starts a drag */}
      <button
        type="button"
        aria-label="نقل"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : null;

  return (
    <div ref={sortable.setNodeRef} style={style}>
      <TileChromeProvider actions={actions}>
        <TileBody {...props} def={def} authed={!!user} />
      </TileChromeProvider>
    </div>
  );
}

function TileBody(props: {
  widget: WidgetInstance;
  breakpoint: Breakpoint;
  editing: boolean;
  authed: boolean;
  def: ReturnType<typeof findWidget>;
  onRemove: () => void;
  onConfigChange: (patch: Record<string, unknown>) => void;
}) {
  const def = props.def;

  if (!def) {
    return <MissingWidget definitionId={props.widget.d} editing={props.editing} onRemove={props.onRemove} />;
  }

  if (def.requires.includes('auth') && !props.authed) {
    return (
      <WidgetShell title={def.name} icon={def.icon}>
        <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
          <p className="text-sm text-muted-foreground">هذا الويدجت يتطلب تسجيل الدخول</p>
          <Button asChild variant="outline" size="sm">
            <a href="/auth/google">
              <LogIn className="ms-1 h-4 w-4" />
              تسجيل الدخول
            </a>
          </Button>
        </div>
      </WidgetShell>
    );
  }

  const Component = def.Component;

  return (
    <Suspense fallback={<WidgetShell title={def.name} icon={def.icon} loading />}>
      <Component
        instanceId={props.widget.i}
        config={props.widget.c}
        span={spanAt(props.widget.w, props.breakpoint)}
        breakpoint={props.breakpoint}
        editing={props.editing}
        onConfigChange={props.onConfigChange}
      />
    </Suspense>
  );
}
