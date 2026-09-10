import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Label } from '@/Components/ui/label';
import { resolveGps, resolveIp, setGeo, type LocMode } from '../_lib/location';

interface Props {
  mode: LocMode;
  onChange: (mode: LocMode) => void;
  cityHint?: string;
}

// Shared location-source selector (Muslim prayer modal, homepage settings,
// Roznama settings): GPS first, IP second, manual city last. Selecting GPS
// or IP resolves immediately (the radio IS the button); the city option
// just switches mode. Failures keep the previous mode and show the reason.
export default function LocationModeSelector({ mode, onChange, cityHint }: Props) {
  const [busy, setBusy] = useState<'gps' | 'ip' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const select = async (id: LocMode) => {
    // Manual city and manual coords switch instantly; GPS/IP (re-)resolve
    // on every tap so the position can be refreshed. Failures keep the
    // previous mode.
    if (id === 'city' || id === 'custom') {
      setError(null);
      onChange(id);
      return;
    }
    setBusy(id);
    setError(null);
    try {
      const geo = id === 'gps' ? await resolveGps() : await resolveIp();
      setGeo(geo);
      onChange(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر التحديد');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">مصدر الموقع</Label>
      {([
        { id: 'gps', title: 'موقع الجهاز (GPS)', desc: 'الأدق — يطلب إذن المتصفح لمرة واحدة' },
        { id: 'ip', title: 'التعرف عبر الإنترنت', desc: 'تقريبي لمدينتك عبر عنوان IP — بلا أذونات' },
        { id: 'city', title: 'مدينة يدوية', desc: cityHint ?? 'اختر من قائمة المحافظات' },
        { id: 'custom', title: 'إحداثيات يدوية', desc: 'أدخل خط العرض وخط الطول بنفسك' },
      ] as Array<{ id: LocMode; title: string; desc: string }>).map((o) => {
        const activeOpt = mode === o.id;
        const loading = busy === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => void select(o.id)}
            aria-pressed={activeOpt}
            disabled={busy !== null}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-right transition-colors disabled:opacity-70 ${
              activeOpt ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20' : 'border-border/50 bg-card/20 hover:bg-muted/20'
            }`}
          >
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${activeOpt ? 'border-primary' : 'border-muted-foreground/40'}`}>
              {activeOpt && !loading && <span className="h-2 w-2 rounded-full bg-primary" />}
              {loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </span>
            <span>
              <span className="block text-xs font-bold">{o.title}</span>
              <span className="block text-[11px] text-muted-foreground">{o.desc}</span>
            </span>
          </button>
        );
      })}
      {error && (
        <p className="text-[11px] leading-relaxed text-destructive">{error}</p>
      )}
    </div>
  );
}
