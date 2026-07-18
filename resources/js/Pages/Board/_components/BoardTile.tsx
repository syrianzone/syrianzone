import { Suspense } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/Contexts/AuthContext';
import { Button } from '@/Components/ui/button';
import { findWidget } from '../_lib/registry';
import { spanAt } from '../_lib/layout';
import type { Breakpoint, WidgetInstance } from '../_lib/types';
import { WidgetShell } from './WidgetShell';
import { MissingWidget } from './MissingWidget';

// Capability gates live here, never inside a widget: a widget body should be
// able to assume it is allowed to run.
export function BoardTile(props: {
  widget: WidgetInstance;
  breakpoint: Breakpoint;
  editing: boolean;
  onRemove: () => void;
  onConfigChange: (patch: Record<string, unknown>) => void;
}) {
  const { user } = useAuth();
  const def = findWidget(props.widget.d);

  if (!def) {
    return <MissingWidget definitionId={props.widget.d} editing={props.editing} onRemove={props.onRemove} />;
  }

  if (def.requires.includes('auth') && !user) {
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
