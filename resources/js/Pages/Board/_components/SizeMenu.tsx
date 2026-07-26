import { Maximize2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { WidgetDefinition, WidgetSize } from '../_lib/types';

// Discrete sizes, not drag handles. Free resize on a flow grid buys little and
// is where the RTL and touch bugs live; corner-drag can come later without
// changing the stored format.
const WIDTHS: { w: number; label: string }[] = [
  { w: 2, label: 'سدس (2)' },
  { w: 3, label: 'ربع (3)' },
  { w: 4, label: 'ثلث (4)' },
  { w: 6, label: 'نصف (6)' },
  { w: 8, label: 'ثلثين (8)' },
  { w: 12, label: 'كامل (12)' },
];

const HEIGHTS: { h: number; label: string }[] = [
  { h: 1, label: 'صف واحد (1)' },
  { h: 2, label: 'صفين (2)' },
  { h: 3, label: '3 صفوف (3)' },
  { h: 4, label: '4 صفوف (4)' },
  { h: 6, label: '6 صفوف (6)' },
  { h: 8, label: '8 صفوف (8)' },
];

export function SizeMenu(props: {
  def: WidgetDefinition;
  size: WidgetSize;
  onResize: (size: WidgetSize) => void;
}) {
  const widths = WIDTHS;
  const heights = HEIGHTS;

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
        {widths.map((o) => (
          <DropdownMenuItem
            key={o.w}
            onSelect={() => props.onResize({ w: o.w, h: props.size.h })}
            className={props.size.w === o.w ? 'font-semibold text-foreground' : undefined}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>الارتفاع</DropdownMenuLabel>
        {heights.map((o) => (
          <DropdownMenuItem
            key={o.h}
            onSelect={() => props.onResize({ w: props.size.w, h: o.h })}
            className={props.size.h === o.h ? 'font-semibold text-foreground' : undefined}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
