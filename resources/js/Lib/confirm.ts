/**
 * Imperative confirmation, backed by the app's own <AlertDialog>.
 *
 * Replaces every native window.confirm / confirm() call. Because it is a plain
 * function (not a hook) any handler can await it with a single import:
 *
 *   if (!(await confirmDialog({ title: 'حذف المكان نهائياً؟', destructive: true }))) return
 *
 * <ConfirmHost/> (mounted once in MainLayout) renders the dialog and resolves
 * the promise from the user's choice.
 */
export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

type Resolver = (confirmed: boolean) => void;
type Opener = (options: ConfirmOptions, resolve: Resolver) => void;

interface Pending {
  options: ConfirmOptions;
  resolve: Resolver;
}

let opener: Opener | null = null;
/** Asked before the host mounted its dialog; shown once it does. */
const queue: Pending[] = [];
let showing = false;

function pump() {
  if (!opener || showing) return;
  const next = queue.shift();
  if (!next) return;

  showing = true;
  opener(next.options, (confirmed) => {
    showing = false;
    next.resolve(confirmed);
    pump();
  });
}

export function registerConfirmOpener(fn: Opener | null) {
  opener = fn;
  pump();
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    queue.push({ options, resolve });
    pump();
  });
}
