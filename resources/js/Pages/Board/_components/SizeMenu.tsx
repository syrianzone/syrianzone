import { Maximize2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { allowedSizes } from '../_lib/doc';
import type { WidgetDeclaration, WidgetSize } from '../_lib/types';

// Discrete sizes, not drag handles. Free resize on a flow grid buys little and
// is where the RTL and touch bugs live. The choices come from `allowedSizes()`,
// so the menu can only offer what the widget declares and the reducer stores.
const LABELS: Record<number, string> = {
  1: 'صف واحد (1)',
  2: 'صفين (2)',
  3: '3 صفوف (3)',
  4: '4 صفوف (4)',
  6: '6 صفوف (6)',
  8: '8 صفوف (8)',
};

const WIDTH_LABELS: Record<number, string> = {
  2: 'سدس (2)',
  3: 'ربع (3)',
  4: 'ثلث (4)',
  6: 'نصف (6)',
  8: 'ثلثين (8)',
  12: 'كامل (12)',
};

export function SizeMenu(props: {
  def: WidgetDeclaration;
  size: WidgetSize;
  onResize: (size: WidgetSize) => void;
}) {
  const { widths, heights } = allowedSizes(props.def);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="الحجم"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      {/* direction comes from the app-level DirectionProvider */}
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuLabel>العرض</DropdownMenuLabel>
        {widths.map((w) => (
          <DropdownMenuItem
            key={w}
            onSelect={() => props.onResize({ w, h: props.size.h })}
            className={props.size.w === w ? 'font-semibold text-foreground' : undefined}
          >
            {WIDTH_LABELS[w] ?? String(w)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>الارتفاع</DropdownMenuLabel>
        {heights.map((h) => (
          <DropdownMenuItem
            key={h}
            onSelect={() => props.onResize({ w: props.size.w, h })}
            className={props.size.h === h ? 'font-semibold text-foreground' : undefined}
          >
            {LABELS[h] ?? String(h)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
