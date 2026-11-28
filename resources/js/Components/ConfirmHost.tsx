import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import {
  registerConfirmOpener,
  type ConfirmOptions,
} from '@/Lib/confirm';
import { cn } from '@/Lib/utils';

interface Pending {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

/**
 * Mounts once in MainLayout. Turns confirmDialog() calls into a styled, RTL,
 * focus-trapped AlertDialog. Rendered without open-state when idle so it is
 * inert until needed.
 */
export default function ConfirmHost() {
  const [pending, setPending] = React.useState<Pending | null>(null);

  React.useEffect(() => {
    registerConfirmOpener((options, resolve) => setPending({ options, resolve }));
    return () => registerConfirmOpener(null);
  }, []);

  const settle = (confirmed: boolean) => {
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
  };

  const options = pending?.options;

  return (
    <AlertDialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          {options?.description ? (
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">تأكيد الإجراء</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {options?.cancelText || 'إلغاء'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
            className={cn(
              options?.destructive &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            )}
          >
            {options?.confirmText || 'تأكيد'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
