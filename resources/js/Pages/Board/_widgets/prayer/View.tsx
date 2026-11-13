import { useEffect, useState } from 'react';
import { Moon } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import { useWidgetQuery } from '../../_lib/query';
import { sources } from '../../_lib/sources';
import { GOVERNORATES_BY_ID } from '@/Domain/geography/governorates';
import type { WidgetProps } from '../../_lib/types';
import { prayerWidget, type PrayerConfig } from './index';
import { useLocationPreference, resolvePrayerParams } from '@/Domain/location/preference';
import { nextPrayer } from '@/Domain/prayer/nextPrayer';
import { readStoredMethod } from '@/Domain/settings/prefs';

function countdown(to: Date, now: Date): string {
  const total = Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h} س ${m} د` : `${m} د`;
}

export default function PrayerView({ config }: WidgetProps<PrayerConfig>) {
  // The widget's own city/method win; otherwise it follows the site's location
  // preference (set in /muslim, Home or Roznama), including a resolved GPS/IP
  // point and manual coordinates.
  const location = useLocationPreference();
  const governorate = config.governorate ?? location.city;
  const storedMethod = readStoredMethod();
  const method = Number(config.method ?? storedMethod) || storedMethod;
  const params = resolvePrayerParams({ ...location, city: governorate }, method);
  const query = useWidgetQuery(prayerWidget, JSON.stringify(params), () =>
    sources.prayerTimes(params),
  );
  const [now, setNow] = useState(() => new Date());

  // the countdown ticks locally; refetching once a day is enough for the timings
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  const timings: Record<string, string> | undefined = query.data?.timings;
  // A tile this small says "today's prayers are over" instead of showing
  // tomorrow's Fajr: rollover off, the one named difference from the pages.
  const next = timings ? nextPrayer(timings, now, { rollover: false }) : null;
  const hijri = query.data?.hijri;

  return (
    <WidgetShell
      title={`مواقيت الصلاة · ${GOVERNORATES_BY_ID[governorate]?.nameAr ?? ''}`}
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
