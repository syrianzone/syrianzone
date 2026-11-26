import React, { useMemo } from 'react';
import { Link } from '@inertiajs/react';
import { AlertCircle, Calendar, Check, ChevronLeft, Compass, HelpCircle, MapPin, MoonStar, Settings } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/Components/ui/accordion';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import { formatDuration } from '../../../Lib/format';
import { formatGregorianSyrianShort } from '../../../Lib/syrian-date';
import { PRAYER_KEYS, PRAYER_LABELS, type PrayerKey } from '../../../Domain/prayer/methods';
import { TRACKED_PRAYERS, todayKey, type MuslimPrefs } from '../../../Domain/settings/prefs';
import { hijriDateLabel } from '../../../Domain/prayer/hijri';
import { prayerSchedule } from '../../../Domain/prayer/nextPrayer';
import { PrayerIcon } from '../../../Domain/prayer/PrayerIcon';
import PrayerSettingsFields from '../../../Domain/prayer/PrayerSettingsFields';
import ResponsiveSettingsDialog from '../../../Domain/prayer/ResponsiveSettingsDialog';
import { usePrayerTimes, type PrayerHijri } from '../../../Domain/prayer/times';
import { useNow } from '../../../Domain/prayer/useNow';
import type { MonthlyPrayerCalendar, QiblaInfo, TodaySyriaInfo } from '../../../Domain/prayer/ramadan';
import { resolvePlaceLabel, useLocationPreference, type LocationPreference } from '../../../Domain/location/preference';
import { governoratesByPickerOrder } from '../../../Domain/geography/governorates';
import { usePageDialog } from '@/Lib/appShell';

interface Props {
  prefs: MuslimPrefs;
  setPrefs: (p: Partial<MuslimPrefs>) => void;
  isLoggedIn: boolean;
  initialCity?: string | null;
  initialCityName?: string | null;
  initialPrayer?: {
    governorate: string;
    method: number;
    timings: Record<string, string>;
    hijri: PrayerHijri | null;
  } | null;
  monthlyCalendar?: MonthlyPrayerCalendar | null;
  qibla?: QiblaInfo | null;
  todayInfo?: TodaySyriaInfo | null;
}

export default function PrayerView({
  prefs,
  setPrefs,
  isLoggedIn,
  initialCity = null,
  initialCityName = null,
  initialPrayer = null,
  monthlyCalendar = null,
  qibla = null,
  todayInfo = null,
}: Props) {
  // Null until mounted: the countdown and the active row come from the
  // visitor's clock, never from the server's render.
  const now = useNow();
  const storedLocation = useLocationPreference();
  const location: LocationPreference = useMemo(
    () => (initialCity
      ? { ...storedLocation, city: initialCity, useCustomCoords: false, geo: null }
      : storedLocation),
    [initialCity, storedLocation],
  );
  const { timings, hijri, loading, error: prayerError, timeZone, reload } = usePrayerTimes(location, prefs.method, {
    timeoutMs: 12_000,
    initialData: initialPrayer && initialPrayer.method === prefs.method
      ? { timings: initialPrayer.timings, hijri: initialPrayer.hijri }
      : null,
  });
  // A timed-out request keeps the previous list on screen (no error copy) on
  // this page; the "إعادة المحاولة" button appears only for real failures.
  const error = prayerError && !prayerError.timedOut
    ? prayerError.message || 'حدث خطأ أثناء الاتصال'
    : null;

  const schedule = useMemo(
    () => (now ? prayerSchedule(timings, now, { timeZone }) : null),
    [timings, now, timeZone],
  );
  const apiHijri = hijriDateLabel(hijri);

  // Today's completion log (Asia/Damascus day). Guests keep it in
  // localStorage; logged-in users sync it to their account.
  const dayKey = todayKey(now ?? undefined);
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

  const cityLabel = initialCityName ?? resolvePlaceLabel(location);
  const ramadanHref = initialCity ? `/muslim/ramadan/${initialCity}` : '/muslim/ramadan';
  const ramadanCtaTitle = initialCityName
    ? `إمساكية رمضان 1448 هـ / 2027 م في ${initialCityName}`
    : 'إمساكية رمضان 1448 هـ / 2027 م في سوريا';

  const otherCities = useMemo(() => {
    const all = governoratesByPickerOrder();
    return initialCity ? all.filter((gov) => gov.id !== initialCity) : all;
  }, [initialCity]);

  const [prayerSettingsOpen, setPrayerSettingsOpen] = usePageDialog('muslim-prayer-settings');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card className="border-border bg-card/60">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">{cityLabel}</h2>
              {(todayInfo?.gregorian_ar || apiHijri) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {todayInfo?.gregorian_ar ? <span>{todayInfo.gregorian_ar}</span> : null}
                  {todayInfo?.gregorian_ar && apiHijri ? <span> · </span> : null}
                  {apiHijri ? <span>{apiHijri} هـ</span> : null}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {apiHijri && <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">{apiHijri} هـ</Badge>}
              <Badge variant="secondary" dir="ltr" className="text-[10px] tabular-nums lg:hidden">{doneCount}/5</Badge>
              <Button aria-label="إعدادات المواقيت" variant="ghost" size="sm" className="h-9 gap-1.5 px-2.5 text-xs" title="إعدادات المواقيت"
                onClick={() => setPrayerSettingsOpen(true)}>
                <Settings className="h-4 w-4" aria-hidden="true" />
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

          {/* Server-rendered timings get a placeholder box until the clock
              mounts, so the countdown fills in without moving the list. */}
          {(schedule?.next || (!now && timings)) && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/10 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  {schedule?.next
                    ? <PrayerIcon prayer={schedule.next.key} className="h-5 w-5" />
                    : <span className="block h-5 w-5" aria-hidden="true" />}
                </div>
                <span className="text-base font-bold text-primary">
                  {schedule?.next ? `صلاة ${schedule.next.label}` : 'الصلاة القادمة'}
                </span>
              </div>
              <div className="text-end font-mono">
                <span className="block text-start text-xs font-medium text-foreground/70">المتبقي</span>
                <span dir="ltr" className="text-xl font-bold tracking-wider text-primary">
                  {schedule?.next ? formatDuration(schedule.next.remainingMs) : '--:--:--'}
                </span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="min-h-[348px]" aria-hidden="true" />
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-destructive">
              <AlertCircle className="h-8 w-8" aria-hidden="true" /><p role="alert">{error}</p>
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
                        <Button aria-label={`أدّيت صلاة ${PRAYER_LABELS[key]}`}
                          aria-pressed={checked}
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
                          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!isLoggedIn && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              <a href="/auth/google" className="font-semibold text-primary hover:underline">سجّل الدخول</a> لحفظ سجل صلواتك في حسابك.
            </p>
          )}
          <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
            تُحسب المواقيت وفق طريقة رابطة العالم الإسلامي (فجر 18° وعشاء 17°) بتوقيت دمشق.
          </p>
        </CardContent>
      </Card>

      {/* Dates, Qibla bearing & Ramadan imsakiya link */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {qibla && (
          <Card className="border-border bg-card/60">
            <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <Compass className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>اتجاه القبلة في {initialCityName ?? 'دمشق'}</span>
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {qibla.description_ar}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-center rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-center">
                  <span dir="ltr" className="font-mono text-lg font-bold tabular-nums text-primary">
                    {qibla.degrees}°
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">{qibla.direction_ar}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                القياس من الشمال الحقيقي باتجاه عقارب الساعة نحو الكعبة المشرفة (<span dir="ltr">21.4225° N, 39.8262° E</span>).
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                <MoonStar className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{ramadanCtaTitle}</span>
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                جدول الشهر المبارك كاملاً مع مواعيد الإمساك والفجر والإفطار (المغرب) ونسخة جاهزة للطباعة.
              </p>
            </div>
            <div>
              <Link
                href={ramadanHref}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline transition-colors hover:bg-primary/90"
              >
                <span>عرض إمساكية رمضان 1448</span>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Gregorian timetable (rendered from SSR props; gracefully omitted if fetch failed) */}
      {monthlyCalendar && monthlyCalendar.days.length > 0 && (
        <section aria-labelledby="monthly-timetable-heading">
          <Card className="border-border bg-card/60">
            <CardContent className="p-5 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="monthly-timetable-heading" className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
                  <span>جدول مواقيت الصلاة لشهر {monthlyCalendar.month_ar} {monthlyCalendar.year} في {initialCityName ?? 'دمشق'}</span>
                </h2>
                <span className="text-xs text-muted-foreground">توقيت دمشق (24 ساعة)</span>
              </div>

              <Table>
                <caption className="sr-only">
                  جدول مواقيت الصلاة اليومية لشهر {monthlyCalendar.month_ar} {monthlyCalendar.year} في {initialCityName ?? 'دمشق'}
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="whitespace-nowrap">التاريخ</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">اليوم</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">الفجر</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">الشروق</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">الظهر</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">العصر</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">المغرب</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">العشاء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyCalendar.days.map((day) => {
                    const isToday = todayInfo?.iso === day.date;
                    return (
                      <TableRow
                        key={day.date}
                        aria-current={isToday ? 'date' : undefined}
                        className={isToday ? 'bg-primary/10 font-semibold hover:bg-primary/15' : undefined}
                      >
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{formatGregorianSyrianShort(day.date)}</span>
                            {isToday && (
                              <Badge variant="secondary" className="text-[10px]">اليوم</Badge>
                            )}
                          </div>
                          {day.hijri_day && day.hijri_month && (
                            <div className={isToday ? 'text-[11px] text-foreground/80' : 'text-[11px] text-muted-foreground'}>
                              {day.hijri_day} {day.hijri_month} {day.hijri_year} هـ
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{day.weekday_ar}</TableCell>
                        <TableCell dir="ltr" className="font-mono tabular-nums whitespace-nowrap">{day.timings.Fajr}</TableCell>
                        <TableCell dir="ltr" className="font-mono tabular-nums whitespace-nowrap">{day.timings.Sunrise}</TableCell>
                        <TableCell dir="ltr" className="font-mono tabular-nums whitespace-nowrap">{day.timings.Dhuhr}</TableCell>
                        <TableCell dir="ltr" className="font-mono tabular-nums whitespace-nowrap">{day.timings.Asr}</TableCell>
                        <TableCell dir="ltr" className="font-mono tabular-nums whitespace-nowrap">{day.timings.Maghrib}</TableCell>
                        <TableCell dir="ltr" className="font-mono tabular-nums whitespace-nowrap">{day.timings.Isha}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Arabic FAQ section */}
      <section aria-labelledby="prayer-faq-heading">
        <Card className="border-border bg-card/60">
          <CardContent className="p-5 sm:p-6">
            <h2 id="prayer-faq-heading" className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
              <HelpCircle className="h-5 w-5 text-primary" aria-hidden="true" />
              <span>أسئلة شائعة حول مواقيت الصلاة</span>
            </h2>
            <Accordion type="multiple" defaultValue={['method']}>
              <AccordionItem value="method">
                <AccordionTrigger>ما طريقة الحساب المعتمدة لمواقيت الصلاة في سوريا ولماذا؟</AccordionTrigger>
                <AccordionContent>
                  <p>
                    نعتمد افتراضياً طريقة <strong>رابطة العالم الإسلامي</strong> (زاوية الفجر 18° وزاوية العشاء 17°)، لأنها المعيار الفلكي المتوافق مع التوقيت الرسمي المعتمد في المساجد السورية. ويمكنك تغيير طريقة الحساب من زر الإعدادات أعلاه إذا كنت تتبع مذهباً أو تقويماً آخر.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="difference">
                <AccordionTrigger>لماذا قد يختلف الوقت المعروض عن أذان المسجد القريب بدقيقة أو دقيقتين؟</AccordionTrigger>
                <AccordionContent>
                  <p>
                    تُحسب المواقيت لإحداثيات مركز المحافظة، بينما تعتمد بعض المساجد والمواقيت الورقية هوامش احتياط (دقيقة إلى دقيقتين) أو تختلف قليلاً بحسب الموقع الجغرافي داخل المحافظة والارتفاع عن سطح البحر وتقريب الثواني.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="imsak">
                <AccordionTrigger>ما علاقة وقت الإمساك بوقت صلاة الفجر؟</AccordionTrigger>
                <AccordionContent>
                  <p>
                    وقت الإمساك هو تنبيه احتياطي يسبق أذان الفجر بنحو عشر دقائق للتنبيه إلى قرب انتهاء وقت السحور، أما بداية الصيام شرعياً فتكون عند طلوع الفجر الصادق (وقت صلاة الفجر).
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="qibla">
                <AccordionTrigger>كيف يُحسب اتجاه القبلة للمحافظة؟</AccordionTrigger>
                <AccordionContent>
                  <p>
                    يُحسب اتجاه القبلة هندسياً عبر مسار الدائرة العظمى من إحداثيات مركز المحافظة إلى الكعبة المشرفة في مكة المكرمة (<span dir="ltr">21.4225° N, 39.8262° E</span>)، وتُقاس الزاوية بالدرجات من الشمال الحقيقي باتجاه عقارب الساعة.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="imsakiya">
                <AccordionTrigger>أين أجد إمساكية شهر رمضان المبارك كاملةً؟</AccordionTrigger>
                <AccordionContent>
                  <p>
                    يمكنك تصفح جدول الشهر الكريم كاملاً مع مواعيد الإمساك والإفطار ونسخة مخصصة للطباعة في صفحة{' '}
                    <Link href={ramadanHref} className="font-semibold text-primary underline underline-offset-4">
                      {ramadanCtaTitle}
                    </Link>.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Syrian Governorates Prayer Times Directory (internal SEO links) */}
      <nav aria-label={initialCity ? 'مواقيت الصلاة في محافظات أخرى' : 'مواقيت الصلاة في المحافظات السورية'} className="rounded-xl border border-border/70 bg-card/50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2>{initialCity ? 'مواقيت الصلاة في محافظات أخرى' : 'مواقيت الصلاة في المحافظات السورية'}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {otherCities.map((gov) => (
            <Link
              key={gov.id}
              href={`/muslim/prayer/${gov.id}`}
              className="rounded-lg border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {gov.nameAr}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
