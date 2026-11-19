import { assetUrl, integer, record, text, array } from './validation';

export interface PublicPopup {
  enabled: boolean;
  title: string;
  description: string;
  buttonText: string;
  dismissText: string;
  link: string;
  version: number;
}
export function decodePublicPopup(value: unknown): PublicPopup {
  const row = record(value),
    link = assetUrl(row.link),
    version = integer(row.version);
  if (typeof row.enabled !== 'boolean' || !link || version < 1) throw new Error('بيانات تنبيه الموقع غير صالحة.');
  return {
    enabled: row.enabled,
    title: text(row.title),
    description: text(row.description),
    buttonText: text(row.buttonText),
    dismissText: text(row.dismissText),
    link,
    version
  };
}
export function decodePopupDismissals(value: unknown): number[] {
  return [
    ...new Set(
      array(value).map((item) => {
        const version = integer(item);
        if (version < 1) throw new Error('سجل التنبيهات غير صالح.');
        return version;
      })
    )
  ];
}
interface PopupEffects {
  schedule(task: () => void, delay: number): () => void;
  persist(version: number): Promise<void>;
  show(visible: boolean): void;
}
export function createPopupSession(version: number, previouslyDismissed: boolean, effects: PopupEffects) {
  let stop: (() => void) | null = null,
    visible = false,
    eligible = false,
    quiet = false,
    dismissed = previouslyDismissed,
    disposed = false,
    pending: Promise<void> | null = null;
  const cancel = () => {
    stop?.();
    stop = null;
  };
  const hide = () => {
    cancel();
    if (visible && !disposed) {
      visible = false;
      effects.show(false);
    }
  };
  return {
    setEligible(value: boolean): void {
      eligible = value;
      if (!value) {
        hide();
        return;
      }
      if (disposed || dismissed || quiet || visible || stop) return;
      stop = effects.schedule(() => {
        stop = null;
        if (!disposed && eligible && !dismissed && !quiet) {
          visible = true;
          effects.show(true);
        }
      }, 2000);
    },
    quiet(): void {
      quiet = true;
      hide();
    },
    dismiss(): Promise<void> {
      if (pending) return pending;
      if (dismissed || disposed) return Promise.resolve();
      pending = effects
        .persist(version)
        .then(() => {
          dismissed = true;
          hide();
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
    dispose(): void {
      cancel();
      disposed = true;
    }
  };
}
// PORT STATUS: source Components/UnblockSyriaNotification.tsx; confidence high; todos 0.
