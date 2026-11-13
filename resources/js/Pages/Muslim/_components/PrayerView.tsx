import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Settings } from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { formatDuration } from '../../../Lib/format';
import { PRAYER_KEYS, PRAYER_LABELS, type PrayerKey } from '../../../Domain/prayer/methods';
import { TRACKED_PRAYERS, todayKey, type MuslimPrefs } from '../../../Domain/settings/prefs';
import { hijriDateLabel } from '../../../Domain/prayer/hijri';
import { prayerSchedule } from '../../../Domain/prayer/nextPrayer';
import { PrayerIcon } from '../../../Domain/prayer/PrayerIcon';
import PrayerSettingsFields from '../../../Domain/prayer/PrayerSettingsFields';
import ResponsiveSettingsDialog from '../../../Domain/prayer/ResponsiveSettingsDialog';
import { usePrayerTimes } from '../../../Domain/prayer/times';
import { resolvePlaceLabel, useLocationPreference } from '../../../Domain/location/preference';
import { useAppShell } from '@/Lib/appShell';

interface Props {
  prefs: MuslimPrefs;
  setPrefs: (p: Partial<MuslimPrefs>) => void;
  isLoggedIn: boolean;
}

export default function PrayerView({ prefs, setPrefs, isLoggedIn }: Props) {
  const [now, setNow] = useState(() => new Date());
  const location = useLocationPreference();
  const { timings, hijri, loading, error: prayerError, reload } = usePrayerTimes(location, prefs.method, {
    timeoutMs: 12_000,
  });
  // A timed-out request keeps the previous list on screen (no error copy) on
  // this page; the "إعادة المحاولة" button appears only for real failures.
  const error = prayerError && !prayerError.timedOut
    ? prayerError.message || 'حدث خطأ أثناء الاتصال'
    : null;

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const schedule = useMemo(() => prayerSchedule(timings, now), [timings, now]);
  const apiHijri = hijriDateLabel(hijri);

  // Today's completion log (Asia/Damascus day). Guests keep it in
  // localStorage; logged-in users sync it to their account.
  const dayKey = todayKey(now);
  const doneToday = prefs.prayerLog[dayKey] ?? {};
  const doneCount = (TRACKED_PRAYERS as readonly string[]).filter((k) => doneToday[k]).length;

  const togglePrayer = (key: PrayerKey) => {
    setPrefs({
      prayerLog: {
        ...prefs.prayerLog,
        [dayKey]: { ...doneToday, [key]: !doneToday[key] },
      },
    });
  };

  const cityLabel = resolvePlaceLabel(location);

  const prayerSettingsOpen = useAppShell((s) => s.muslimPrayerSettingsOpen);
  const setPrayerSettingsOpen = useAppShell((s) => s.setMuslimPrayerSettingsOpen);

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="border-border bg-card/60">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/60 pb-3">
            <h2 className="min-w-0 truncate text-lg font-bold">{cityLabel}</h2>
            <div className="flex shrink-0 items-center gap-1.5">
              {apiHijri && <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">{apiHijri} هـ</Badge>}
              <Badge variant="secondary" dir="ltr" className="text-[10px] tabular-nums lg:hidden">{doneCount}/5</Badge>
              <Button aria-label="إعدادات المواقيت" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" title="إعدادات المواقيت"
                onClick={() => setPrayerSettingsOpen(true)}>
                <Settings className="h-4 w-4" />
                <span>الإعدادات</span>
              </Button>
            </div>
          </div>

          <ResponsiveSettingsDialog
            open={prayerSettingsOpen}
            onOpenChange={setPrayerSettingsOpen}
            title="إعدادات المواقيت"
            description="المدينة والإحداثيات وطريقة الحساب — تُستخدم أيضاً في الروزنامة ولوح والرئيسية."
          >
            <PrayerSettingsFields
              cityLabel="المدينة"
              method={prefs.method}
              onMethodChange={(method) => setPrefs({ method })}
              methodNote=" — الطريقة رأي فقهي: قارن مع مسجدك، وبدّلها إن خالفته."
              onLocationChange={setPrefs}
            />
          </ResponsiveSettingsDialog>

          {schedule?.next && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/10 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <PrayerIcon prayer={schedule.next.key} className="h-5 w-5" />
                </div>
                <span className="text-base font-bold text-primary">صلاة {schedule.next.label}</span>
              </div>
              <div className="text-left font-mono">
                <span className="block text-right text-xs font-medium text-foreground/70">المتبقي</span>
                <span dir="ltr" className="text-xl font-bold tracking-wider text-primary">
                  {formatDuration(schedule.next.remainingMs)}
                </span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-red-500">
              <AlertCircle className="h-8 w-8" /><p>{error}</p>
              <Button variant="outline" size="sm" onClick={reload}>إعادة المحاولة</Button>
            </div>
          ) : timings ? (
            <div className="space-y-2">
              {PRAYER_KEYS.map((key) => {
                const isActive = schedule?.active?.key === key;
                const isNext = schedule?.next?.key === key;
                const trackable = (TRACKED_PRAYERS as readonly string[]).includes(key);
                const checked = trackable && !!doneToday[key];
                return (
                  <div key={key}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition-all ${
                      isActive ? 'scale-[1.02] border-primary bg-primary text-primary-foreground shadow-sm'
                      : isNext ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/10'
                      : 'border-border/50 bg-muted/10 hover:bg-muted/20'
                    }`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <PrayerIcon prayer={key} className={`h-4 w-4 shrink-0 ${isActive ? '' : 'text-primary'}`} />
                      <span className="text-sm font-semibold">{PRAYER_LABELS[key]}</span>
                      {isActive && (
                        <Badge className="h-5 bg-primary-foreground px-1.5 text-[10px] font-bold text-primary">الآن</Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span dir="ltr" className="font-mono text-sm font-bold tabular-nums">{timings[key]?.slice(0, 5)}</span>
                      {trackable && (
                        <Button aria-label={checked ? `تمت صلاة ${PRAYER_LABELS[key]} — اضغط للتراجع` : `علّم صلاة ${PRAYER_LABELS[key]} كمنجزة`}
                          variant="ghost" size="icon"
                          title={checked ? `تمت صلاة ${PRAYER_LABELS[key]} — اضغط للتراجع` : `علّم صلاة ${PRAYER_LABELS[key]} كمنجزة`}
                          onClick={() => togglePrayer(key)}
                          className={`h-9 w-9 rounded-full border transition-colors ${
                            checked
                              ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                              : isActive
                                ? 'border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/15'
                                : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!isLoggedIn && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              <a href="/auth/google" className="font-semibold text-primary hover:underline">سجّل الدخول</a> لحفظ سجل صلواتك في حسابك.
            </p>
          )}
          <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
            تُحسب المواقيت عبر خادم الموقع (AlAdhan) وتُخزّن مؤقتاً لليوم الحالي بتوقيت دمشق.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
