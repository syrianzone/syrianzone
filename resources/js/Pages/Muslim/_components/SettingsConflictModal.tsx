import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/Components/ui/dialog';
import type { ConflictChoices, ConflictKey, SettingConflict } from '../_lib/settingsSync';

interface Props {
  conflicts: SettingConflict[] | null;
  onApply: (choices: Partial<ConflictChoices>) => Promise<void>;
  onSnooze: () => void;
}

// Explicit per-setting choice when device and account disagree: the user
// picks "this device" or "account" for each conflicting setting. Winners are
// written to both sides, so the next login is quiet.
export default function SettingsConflictModal({ conflicts, onApply, onSnooze }: Props) {
  const [choices, setChoices] = useState<Partial<ConflictChoices>>({});
  const [busy, setBusy] = useState(false);

  const open = conflicts !== null && conflicts.length > 0;
  const allChosen = (conflicts ?? []).every((c) => choices[c.key] !== undefined);

  const pick = (key: ConflictKey, side: 'local' | 'server') => {
    setChoices((prev) => ({ ...prev, [key]: side }));
  };

  const apply = async () => {
    setBusy(true);
    try {
      await onApply(choices);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSnooze(); }}>
      <DialogContent dir="rtl" className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            إعدادات مختلفة بين جهازك وحسابك
          </DialogTitle>
          <DialogDescription>
            غيّرت بعض الإعدادات على هذا الجهاز وأنت مسجّل الخروج، وحسابك يحمل قيماً أخرى.
            اختر القيمة التي تريد الاحتفاظ بها لكل إعداد — تُحفظ في الجهاز والحساب معاً.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {(conflicts ?? []).map((c) => {
            const picked = choices[c.key];
            return (
              <div key={c.key} className="space-y-2 rounded-lg border border-border/60 p-3">
                <div className="text-sm font-bold">{c.label}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {([
                    { side: 'local', title: 'هذا الجهاز', value: c.local },
                    { side: 'server', title: 'الحساب', value: c.server },
                  ] as const).map((o) => {
                    const active = picked === o.side;
                    return (
                      <button
                        key={o.side}
                        onClick={() => pick(c.key, o.side)}
                        aria-pressed={active}
                        className={`rounded-lg border p-2.5 text-right transition-colors ${
                          active
                            ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border/50 bg-card/20 hover:bg-muted/20'
                        }`}
                      >
                        <span className="mb-1 flex items-center gap-2">
                          <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${active ? 'border-primary' : 'border-muted-foreground/40'}`}>
                            {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                          </span>
                          <span className="text-[11px] font-semibold text-muted-foreground">{o.title}</span>
                        </span>
                        <span className="block truncate text-xs font-bold" title={o.value}>{o.value}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <Button className="w-full" disabled={!allChosen || busy} onClick={() => void apply()}>
            {busy ? 'جاري الحفظ…' : 'اعتماد الاختيارات'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
