import { Suspense, useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, LogIn, MapPin, Scaling, Settings, X } from 'lucide-react';
import { useAuth } from '@/Contexts/AuthContext';
import { Button } from '@/Components/ui/button';
import { findWidget } from '../_lib/registry';
import { colsAt, spanAt } from '../_lib/layout';
import type { Breakpoint, WidgetInstance, WidgetSize } from '../_lib/types';
import { WidgetShell } from './WidgetShell';
import { MissingWidget } from './MissingWidget';
import { TileChromeProvider } from './TileChrome';
import { SizeMenu } from './SizeMenu';
import { useGeo } from './GeoProvider';

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
  const tileRef = useRef<HTMLDivElement | null>(null);

  const [isResizing, setIsResizing] = useState(false);
  const [liveSize, setLiveSize] = useState<WidgetSize | null>(null);
  const liveSizeRef = useRef<WidgetSize | null>(null);

  const setRefs = (node: HTMLDivElement | null) => {
    sortable.setNodeRef(node);
    tileRef.current = node;
  };

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const tileEl = tileRef.current;
    if (!tileEl) return;

    const parentGrid = tileEl.parentElement;
    if (!parentGrid) return;

    const gridRect = parentGrid.getBoundingClientRect();
    const isRTL = document.dir === 'rtl' || getComputedStyle(parentGrid).direction === 'rtl';

    const cols = colsAt(props.breakpoint);
    const gap = 12; // 12px grid gap (gap-3)
    const colWidth = (gridRect.width + gap) / cols;
    const rowHeight = 76 + gap; // 76px row height + 12px gap = 88px

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = props.widget.w;
    const startH = props.widget.h;

    const minW = 1;
    const maxW = cols; // Allow full width up to grid total columns (12)
    const minH = 1;
    const maxH = 8; // Allow heights up to 8 units

    const initialSize = { w: startW, h: startH };
    setLiveSize(initialSize);
    liveSizeRef.current = initialSize;
    setIsResizing(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      // In RTL layout, dragging towards the left (negative deltaX) increases grid columns
      const colChange = Math.round((isRTL ? -deltaX : deltaX) / colWidth);
      const rowChange = Math.round(deltaY / rowHeight);

      const nextW = Math.min(maxW, Math.max(minW, startW + colChange));
      const nextH = Math.min(maxH, Math.max(minH, startH + rowChange));

      const nextSize = { w: nextW, h: nextH };
      setLiveSize(nextSize);
      liveSizeRef.current = nextSize;
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setIsResizing(false);

      if (liveSizeRef.current) {
        props.onResize(liveSizeRef.current);
        liveSizeRef.current = null;
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const currentW = isResizing && liveSize ? liveSize.w : props.widget.w;
  const currentH = isResizing && liveSize ? liveSize.h : props.widget.h;

  const style = {
    gridColumn: `span ${spanAt(currentW, props.breakpoint)}`,
    gridRow: `span ${currentH}`,
    transform: CSS.Translate.toString(sortable.transform),
    transition: isResizing ? 'none' : sortable.transition,
    zIndex: isResizing || sortable.isDragging ? 20 : undefined,
    opacity: sortable.isDragging ? 0.85 : undefined,
    position: 'relative' as const,
  };

  const actions = props.editing ? (
    <div className="flex shrink-0 items-center gap-0.5">
      {def && <SizeMenu def={def} size={{ w: currentW, h: currentH }} onResize={props.onResize} />}
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
    <div ref={setRefs} style={style} className="group/tile relative h-full w-full">
      <TileChromeProvider actions={actions}>
        <TileBody {...props} def={def} authed={!!user} />
      </TileChromeProvider>

      {/* Drag & Drop corner handle to resize both vertically and horizontally */}
      {props.editing && (
        <button
          type="button"
          onPointerDown={handleResizeStart}
          title="سحب لتغيير الحجم"
          aria-label="سحب لتغيير الحجم"
          className="absolute bottom-1 left-1 z-20 flex h-6 w-6 cursor-nwse-resize items-center justify-center rounded-tr-md rounded-bl-lg bg-card/90 text-muted-foreground border border-border shadow-xs hover:bg-primary hover:text-primary-foreground transition-all touch-none opacity-80 group-hover/tile:opacity-100"
        >
          <Scaling className="h-3.5 w-3.5 rotate-90" />
        </button>
      )}

      {/* Live Dimension Overlay during Drag Resizing */}
      {isResizing && liveSize && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-xs border-2 border-dashed border-primary animate-in fade-in">
          <div className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-lg">
            {liveSize.w} × {liveSize.h}
          </div>
        </div>
      )}
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
  const geo = useGeo();
  const needsGeo = !!def?.requires.includes('geo');

  // ask once, on behalf of the widget, so a widget body never has to handle
  // the permission dance itself
  useEffect(() => {
    if (needsGeo && geo.status === 'idle') geo.request();
  }, [needsGeo, geo]);

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

  if (needsGeo && geo.status !== 'granted') {
    if (geo.status === 'denied') {
      return (
        <WidgetShell title={def.name} icon={def.icon}>
          <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
            <p className="text-sm text-muted-foreground">هذا الويدجت يحتاج إلى موقعك</p>
            <Button type="button" variant="outline" size="sm" onClick={geo.request}>
              <MapPin className="ms-1 h-4 w-4" />
              تفعيل الموقع
            </Button>
          </div>
        </WidgetShell>
      );
    }
    return <WidgetShell title={def.name} icon={def.icon} loading />;
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
