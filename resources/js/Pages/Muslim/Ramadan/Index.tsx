import React, { useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Calendar, ChevronLeft, Clock, Info, MapPin, MoonStar } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { MuslimIcon } from '@/Components/Icons/ProjectIcons';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent } from '@/Components/ui/card';
import MuslimShell from '../_components/MuslimShell';
import { governoratesByPickerOrder } from '@/Domain/geography/governorates';
import {
  computeRamadanCountdown,
  daysBetweenIso,
  type ImsakiyaMeta,
  type RamadanImageCredit,
  type TodaySyriaInfo,
} from '@/Domain/prayer/ramadan';
import { formatGregorianSyrianShort } from '@/Lib/syrian-date';

interface RamadanHubProps {
  meta: ImsakiyaMeta;
  images: Record<string, RamadanImageCredit>;
  todayInfo: TodaySyriaInfo;
}

export default function Index({ meta, images, todayInfo }: RamadanHubProps) {
  const cities = governoratesByPickerOrder();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const serverDaysLeft = daysBetweenIso(todayInfo.iso, meta.expected_start_date);
  const duringRamadan = todayInfo.iso >= meta.expected_start_date && todayInfo.iso <= meta.expected_end_date;
  const afterRamadan = todayInfo.iso > meta.expected_end_date;
  const countdown = mounted && now ? computeRamadanCountdown(meta.expected_start_date, now) : null;

  return (
    <MainLayout>
      <MuslimShell title="إمساكية رمضان 1448 هـ / 2027 م" icon={MuslimIcon} width="max-w-5xl">
        <div className="space-y-6">
          {/* Countdown & key dates card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>غرة رمضان المتوقعة فلكياً: {formatGregorianSyrianShort(meta.expected_start_date)}</span>
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {meta.days_count} يوماً · توقيت دمشق
                    </Badge>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    {duringRamadan
                      ? 'شهر رمضان المبارك 1448 هـ جارٍ حالياً'
                      : afterRamadan
                        ? 'أرشيف إمساكية رمضان 1448 هـ / 2027 م'
                        : 'العدّ التنازلي لبداية شهر رمضان المبارك'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {duringRamadan
                      ? 'اختر محافظتك لعرض جدول اليوم ومواقيت الإمساك والفجر والمغرب (الإفطار).'
                      : afterRamadan
                        ? 'انقضى شهر رمضان 1448 هـ؛ تبقى الجداول متاحة للمراجعة والمرجعية الفلكية.'
                        : `متبقٍّ ${Math.max(0, serverDaysLeft)} يوماً تقريباً على الغرة الفلكية (${formatGregorianSyrianShort(meta.expected_start_date)}).`}
                  </p>
                </div>

                {!afterRamadan && !duringRamadan && (
                  <div
                    className="grid grid-cols-4 gap-2 text-center"
                    aria-label="العد التنازلي لبداية شهر رمضان"
                  >
                    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
                      <span dir="ltr" className="block font-mono text-2xl font-bold tabular-nums text-primary">
                        {countdown ? countdown.days : Math.max(0, serverDaysLeft)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">يوم</span>
                    </div>
                    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
                      <span dir="ltr" className="block font-mono text-2xl font-bold tabular-nums text-primary">
                        {countdown ? String(countdown.hours).padStart(2, '0') : '--'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">ساعة</span>
                    </div>
                    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
                      <span dir="ltr" className="block font-mono text-2xl font-bold tabular-nums text-primary">
                        {countdown ? String(countdown.minutes).padStart(2, '0') : '--'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">دقيقة</span>
                    </div>
                    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
                      <span dir="ltr" className="block font-mono text-2xl font-bold tabular-nums text-primary">
                        {countdown ? String(countdown.seconds).padStart(2, '0') : '--'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">ثانية</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Official moon-sighting note */}
          <Alert>
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <h2 className="font-semibold leading-none tracking-tight">تنويه حول تحرّي الهلال وبداية الشهر</h2>
              <AlertDescription>
                التاريخ المعروض (الاثنين {formatGregorianSyrianShort(meta.expected_start_date)}) هو التقدير الفلكي لبداية شهر رمضان 1448 هـ بحسب التقويم الهجري في واجهة المواقيت. أما بداية الصيام ونهاية الشهر فعلياً فتعتمدان على{' '}
                <strong>إعلان تحرّي الهلال الرسمي في سوريا</strong>، وقد يتقدم اليوم الأول أو يتأخر يوماً واحداً تبعاً للرؤية الشرعية.
              </AlertDescription>
            </div>
          </Alert>

          {/* 14 Governorate cards */}
          <section aria-labelledby="ramadan-cities-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 id="ramadan-cities-heading" className="flex items-center gap-2 text-lg font-bold text-foreground">
                <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
                <span>اختر المحافظة لعرض الإمساكية الكاملة</span>
              </h2>
              <Link
                href="/muslim/prayer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <span>مواقيت الصلاة اليومية</span>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cities.map((gov, idx) => {
                const img = images[gov.id];
                return (
                  <Link
                    key={gov.id}
                    href={`/muslim/ramadan/${gov.id}`}
                    className="group overflow-hidden rounded-xl border border-border bg-card/70 no-underline transition-all hover:border-primary/40 hover:shadow-sm"
                  >
                    {img && (
                      <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                        <img
                          src={img.file.replace('/images/ramadan/', '/images/ramadan/thumbs/')}
                          alt={img.alt_ar}
                          width={img.width}
                          height={img.height}
                          loading={idx < 3 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 p-4">
                      <div>
                        <h3 className="text-base font-bold text-foreground group-hover:text-primary">
                          إمساكية رمضان في {gov.nameAr}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {meta.days_count} يوماً · الإمساك والفجر والمغرب
                        </p>
                      </div>
                      <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Short explainer on imsak vs fajr */}
          <Card className="border-border bg-card/60">
            <CardContent className="space-y-3 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
                <span>ما الفرق بين وقت الإمساك وصلاة الفجر؟</span>
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong>وقت الإمساك</strong> هو تنبيه احتياطي يسبق أذان الفجر بعشر دقائق في الجداول الرمضانية، لتذكير الصائم بقرب انقضاء وقت السحور. أما <strong>بدء الصيام شرعياً</strong> فيتحقق عند طلوع الفجر الصادق (وقت أذان الفجر). وتُحسب جميع المواعيد في هذه الإمساكية وفق طريقة رابطة العالم الإسلامي (فجر 18° وعشاء 17°) بتوقيت دمشق.
              </p>
              <div className="pt-1">
                <Link
                  href="/muslim/prayer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground no-underline transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <MoonStar className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>الانتقال إلى مواقيت الصلاة اليومية</span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </MuslimShell>
    </MainLayout>
  );
}
