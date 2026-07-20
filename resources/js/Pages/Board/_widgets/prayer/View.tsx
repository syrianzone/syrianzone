import { useEffect, useState } from 'react';
import { Moon } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import { useWidgetQuery } from '../../_lib/query';
import { sources, type PrayerTimes } from '../../_lib/sources';
import { GOVERNORATES } from '../../_lib/governorates';
import type { WidgetProps } from '../../_lib/types';
import { prayerWidget, type PrayerConfig } from './index';

const PRAYERS: { key: string; label: string }[] = [
  { key: 'Fajr', label: 'الفجر' },
  { key: 'Sunrise', label: 'الشروق' },
  { key: 'Dhuhr', label: 'الظهر' },
  { key: 'Asr', label: 'العصر' },
  { key: 'Maghrib', label: 'المغرب' },
  { key: 'Isha', label: 'العشاء' },
];

type Timings = Record<string, string>;

// Returns the next prayer today, or null once Isha has passed.
function nextPrayer(timings: Timings, now: Date) {
  for (const p of PRAYERS) {
    const raw = timings[p.key];
    if (!raw) continue;
    const [h, m] = raw.slice(0, 5).split(':').map(Number);
    const at = new Date(now);
    at.setHours(h, m, 0, 0);
    if (at > now) return { ...p, at, time: raw.slice(0, 5) };
  }
  return null;
}

function countdown(to: Date, now: Date): string {
  const total = Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h} س ${m} د` : `${m} د`;
}

export default function PrayerView({ config }: WidgetProps<PrayerConfig>) {
  const governorate = config.governorate ?? 'damascus';
  const query = useWidgetQuery(prayerWidget, governorate, () => sources.prayerTimes(governorate));
  const [now, setNow] = useState(() => new Date());

  // the countdown ticks locally; refetching once a day is enough for the timings
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  const data: PrayerTimes | undefined = query.data;
  const next = data ? nextPrayer(data.timings, now) : null;
  const hijri = data?.hijri;

  return (
    <WidgetShell
      title={`مواقيت الصلاة · ${GOVERNORATES[governorate]?.label ?? ''}`}
      icon={Moon}
      loading={query.isPending}
      refreshing={query.isFetching && !query.isPending}
      error={query.isError ? 'تعذر تحميل المواقيت' : null}
      onRetry={() => query.refetch()}
      empty={!!query.data && !next}
      emptyText="انتهت صلوات اليوم"
    >
      {next && (
        <div className="flex h-full flex-col items-center justify-center gap-0.5 p-3">
          <p className="text-xs text-muted-foreground">الصلاة القادمة</p>
          <p className="text-lg font-semibold text-foreground">{next.label}</p>
          <p dir="ltr" className="text-sm tabular-nums text-muted-foreground">{next.time}</p>
          <p className="text-xs text-muted-foreground">بعد {countdown(next.at, now)}</p>
          {hijri && (
            <p className="mt-1 border-t border-border pt-1 text-xs text-muted-foreground">
              <span dir="ltr" className="tabular-nums">{hijri.day}</span> {hijri.month}{' '}
              <span dir="ltr" className="tabular-nums">{hijri.year}</span> هـ
            </p>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
