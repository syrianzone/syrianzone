import React from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/Components/ui/dialog';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/Components/ui/sheet';
import { useIsMobile } from '@/Lib/useIsMobile';
import { cn } from '@/Lib/utils';

/**
 * The settings container: a bottom sheet on a phone, a centred dialog above it.
 *
 * Home, Roznama and `/muslim` show the same settings fields and used to carry
 * three copies of this switch, each with its own sheet geometry and header, so
 * the mobile chrome had to be changed three times. The scroll region, the
 * safe-area padding and the header live here; a surface passes only its copy
 * and, when it needs a wider panel, `contentClassName`.
 */
export interface ResponsiveSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Dialog width only; the sheet is always full width. */
  contentClassName?: string;
  children: React.ReactNode;
}

export default function ResponsiveSettingsDialog({
  open,
  onOpenChange,
  title,
  description,
  contentClassName,
  children,
}: ResponsiveSettingsDialogProps) {
  const isMobile = useIsMobile('md');

  const body = (
    <div
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 sz-scroll touch-pan-y [-webkit-overflow-scrolling:touch]"
      data-lenis-prevent
    >
      {children}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          dir="rtl"
          className="flex max-h-[85dvh] flex-col rounded-t-3xl border-b-0 p-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="shrink-0 px-6 pt-6 text-right">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className={cn('flex max-h-[85vh] flex-col p-0', contentClassName ?? 'sm:max-w-md')}>
        <DialogHeader className="px-6 pt-6 pb-2 text-start">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
