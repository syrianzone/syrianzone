import React from 'react';
import { Hash } from 'lucide-react';

/**
 * The shared "big rank" toggle. The choice is device-local (see
 * `_lib/cardDisplay`), so turning it on here also affects every other card
 * game, and it survives a reload.
 */
export default function CardStyleToggle({ large, onToggle }: { large: boolean; onToggle: () => void }) {
  return (
    // Named by its visible text, "أرقام", with aria-pressed for the state: a
    // label that flips with the state would contradict the pressed value.
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={large}
      title="إظهار الأرقام بدل الأنماط"
      className={`flex h-auto w-11 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition-colors ${
        large
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      <Hash className="h-4 w-4" aria-hidden="true" />
      <span>أرقام</span>
    </button>
  );
}
