import * as React from 'react';
import { badgeVariants } from '@/Components/ui/badge';
import { cn } from '@/Lib/utils';
import type { VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

export interface FilterChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether this chip is the active selection. */
  active?: boolean;
  /** Resting variant when not active (defaults to `outline`). */
  variant?: BadgeVariant;
  /** Visual variant for active selections (defaults to `default`). */
  activeVariant?: BadgeVariant;
}

/**
 * A filter/toggle chip that is a real, keyboard-focusable button with
 * aria-pressed — the accessible replacement for `<Badge onClick={...}>`.
 * Keeps the badge look by reusing badgeVariants.
 */
export const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  function FilterChip({ active = false, variant = 'outline', activeVariant = 'default', className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={active}
        className={cn(
          badgeVariants({ variant: active ? activeVariant : variant }),
          'cursor-pointer select-none transition-colors',
          className
        )}
        {...props}
      />
    );
  }
);

interface FilterChipGroupProps {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onRemove: (value: string) => void;
  onClear: () => void;
  children?: React.ReactNode;
  inputId?: string;
  className?: string;
}

/** One facet chip, with independently removable values and one group clear action. */
export function FilterChipGroup({ label, options, onRemove, onClear, children, inputId, className }: FilterChipGroupProps) {
  return (
    <span role="group" aria-label={`تصفية ${label}`}
      className={cn(
        badgeVariants({ variant: 'outline' }),
        'min-h-9 max-w-full items-start gap-1 rounded-2xl border-border bg-muted/20 py-px pe-0.5 ps-2.5 text-xs font-medium text-foreground focus-within:border-foreground/25',
        className,
      )}>
      <label htmlFor={inputId} className="shrink-0 cursor-text leading-8 text-muted-foreground">{label}</label>
      <span className="relative flex min-w-0 flex-wrap items-center gap-x-0.5">
        {options.map((option, index) => (
          <span key={option.value} className="inline-flex min-w-0 max-w-full items-center">
            {index > 0 && <span className="shrink-0 text-muted-foreground" aria-hidden="true">،</span>}
            <button type="button" onClick={() => onRemove(option.value)}
              aria-label={`إزالة تصفية ${label}: ${option.label}`} title={`إزالة ${option.label}`}
              className="min-h-8 min-w-0 rounded px-0.5 py-0 text-start leading-relaxed break-words hover:line-through focus-visible:line-through focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border">
              {option.label}
            </button>
          </span>
        ))}
        {children}
      </span>
      <button type="button" onClick={onClear} aria-label={`إزالة تصفية ${label} بالكامل`} title={`إزالة تصفية ${label} بالكامل`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border">
        <X className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
      </button>
    </span>
  );
}
