import { toast } from '@/Components/ui/sonner';

/**
 * One feedback language for the whole app.
 *
 * Every action outcome (success / error / info / copy) goes through here instead
 * of native alert(), bespoke toast divs or ad-hoc window.confirm. The Toaster
 * itself is mounted once, in MainLayout.
 *
 * Inline <Alert> stays for *contextual* messages (form errors, disclaimers);
 * toasts are for *outcomes*.
 */
const DEFAULT_DURATION = 3200;
// Errors and warnings usually ask the visitor to do something, so they stay up
// long enough to read twice (the toast also has a close button).
const ATTENTION_DURATION = 8000;

export const notify = {
  success: (message: string, options?: Record<string, unknown>) =>
    toast.success(message, { duration: DEFAULT_DURATION, ...options }),
  // The message is required: the fallback text and the copy confirmation are
  // product copy owned by `Lib/api` and `Lib/copy`, so they are not restated here.
  error: (message: string, options?: Record<string, unknown>) =>
    toast.error(message, { duration: ATTENTION_DURATION, ...options }),
  info: (message: string, options?: Record<string, unknown>) =>
    toast.info(message, { duration: DEFAULT_DURATION, ...options }),
  warning: (message: string, options?: Record<string, unknown>) =>
    toast.warning(message, { duration: ATTENTION_DURATION, ...options }),
  message: (message: string, options?: Record<string, unknown>) =>
    toast(message, { duration: DEFAULT_DURATION, ...options }),
  copy: (message: string) => toast.success(message, { duration: DEFAULT_DURATION }),
};

export type Notify = typeof notify;
