import React, { useState } from 'react';
import { Globe, Loader2, LocateFixed } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import {
  gpsAvailable, resolveGps, resolveIp, setGeo, setLocMode,
  type GeoPoint, type LocMode,
} from '../_lib/location';

interface Props {
  /** Called after a successful resolution (legacy surfaces refresh here). */
  onResolved?: (mode: LocMode, geo: GeoPoint) => void;
  compact?: boolean;
}

// GPS-first, IP-second location resolution. Writes to the shared
// device-local storage every prayer surface reads; manual city lists stay
// as the last resort. Self-contained: works inside /muslim, Home, Roznama.
export default function LocateButtons({ onResolved, compact }: Props) {
  const [busy, setBusy] = useState<'gps' | 'ip' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const run = async (kind: 'gps' | 'ip') => {
    setBusy(kind);
    setStatus(null);
    setIsError(false);
    try {
      const geo = kind === 'gps' ? await resolveGps() : await resolveIp();
      setGeo(geo);
      setLocMode(kind);
      const label = geo.label && geo.label !== 'موقع الجهاز (GPS)' && geo.label !== 'التعرف عبر الإنترنت (IP)'
        ? ` · ${geo.label}`
        : '';
      setStatus(`تم التحديد${label} (${geo.lat}، ${geo.lon})`);
      onResolved?.(kind, geo);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'تعذر التحديد');
      setIsError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className={`flex gap-2 ${compact ? 'flex-row' : 'flex-col sm:flex-row'}`}>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className={compact ? 'h-8 flex-1 gap-1.5 px-2 text-xs' : 'flex-1 gap-2'}
          disabled={busy !== null || !gpsAvailable()}
          onClick={() => void run('gps')}
          title={gpsAvailable() ? 'تحديد الموقع عبر GPS (الأدق)' : 'GPS غير متاح في هذا المتصفح'}
        >
          {busy === 'gps' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          موقع الجهاز
        </Button>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className={compact ? 'h-8 flex-1 gap-1.5 px-2 text-xs' : 'flex-1 gap-2'}
          disabled={busy !== null}
          onClick={() => void run('ip')}
          title="تعرف تقريبي على المدينة عبر الإنترنت (بلا أذونات)"
        >
          {busy === 'ip' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          عبر الإنترنت
        </Button>
      </div>
      {status && (
        <p className={`text-[11px] leading-relaxed ${isError ? 'text-destructive' : 'text-muted-foreground'}`}>
          {status}
        </p>
      )}
    </div>
  );
}
