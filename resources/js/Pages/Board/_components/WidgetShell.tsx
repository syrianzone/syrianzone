import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/Lib/utils';
import { Button } from '@/Components/ui/button';
import { ScrollArea } from '@/Components/ui/scroll-area';
import { useTileActions } from './TileChrome';

// Every widget's chrome and every non-happy state lives here, so no widget ships
// its own spinner and they all degrade the same way.
//
// scroll: the shell wraps the body in a shadcn ScrollArea by default, so list
// widgets get one styled, auto-hiding scrollbar instead of the native one. A
// widget that owns its own scroll region (notes' textarea, todo's list) passes
// scroll={false} and manages it, so the two never stack.
export function WidgetShell(props: {
  title: string;
  icon: LucideIcon;
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  scroll?: boolean;
  children?: ReactNode;
}) {
  const Icon = props.icon;
  const showBody = !props.loading && !props.error && !props.empty;
  const scroll = props.scroll ?? true;
  const tileActions = useTileActions();

  return (
    <div dir="rtl" className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* background refetch is a hairline, not a spinner: a full-tile spinner
          would blank the widget on every interval tick */}
      {props.refreshing && (
        <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-primary/60" aria-hidden="true" />
      )}

      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{props.title}</h3>
        {tileActions}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {props.loading && <WidgetSkeleton />}

        {!props.loading && props.error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
            <p className="text-sm text-destructive">{props.error}</p>
            {props.onRetry && (
              <Button type="button" variant="outline" size="sm" onClick={props.onRetry}>
                إعادة المحاولة
              </Button>
            )}
          </div>
        )}

        {!props.loading && !props.error && props.empty && (
          <div className="flex h-full items-center justify-center p-3">
            <p className="text-center text-sm text-muted-foreground">{props.emptyText ?? 'لا توجد بيانات'}</p>
          </div>
        )}

        {showBody && (scroll ? <ScrollArea className="h-full">{props.children}</ScrollArea> : props.children)}
      </div>
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <div className="space-y-2 p-3" aria-hidden="true">
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-full animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
    </div>
  );
}
