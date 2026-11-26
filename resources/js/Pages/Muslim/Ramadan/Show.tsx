import React from 'react';
import { Link } from '@inertiajs/react';
import { ArrowRight, Calendar, ChevronLeft, Clock, Info, MapPin, Printer } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { MuslimIcon } from '@/Components/Icons/ProjectIcons';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Components/ui/table';
import MuslimShell from '../_components/MuslimShell';
import { governoratesByPickerOrder } from '@/Domain/geography/governorates';
import type { ImsakiyaMeta, ImsakiyaRow, RamadanImageCredit, TodaySyriaInfo } from '@/Domain/prayer/ramadan';
import { formatGregorianSyrianShort } from '@/Lib/syrian-date';

interface RamadanCityProps {
  city: {
    id: string;
    nameAr: string;
    nameEn: string;
    lat: number;
    lng: number;
  };
  meta: ImsakiyaMeta;
  rows: ImsakiyaRow[];
  image: RamadanImageCredit | null;
  todayInfo: TodaySyriaInfo;
}

export default function Show({ city, meta, rows, image, todayInfo }: RamadanCityProps) {
  const otherCities = governoratesByPickerOrder().filter((gov) => gov.id !== city.id);

  return (
    <MainLayout>
      <MuslimShell title={`إمساكية رمضان 2027 في ${city.nameAr}`} icon={MuslimIcon} width="max-w-5xl">
        <div className="space-y-6">
          {/* Print-only title */}
          <div className="hidden border-b border-border pb-3 print:block">
            <p className="text-lg font-bold">إمساكية شهر رمضان 1448 هـ / 2027 م في {city.nameAr} — المساحة السورية</p>
            <p className="text-xs text-muted-foreground">
              بتوقيت دمشق ({meta.timezone}) · طريقة رابطة العالم الإسلامي (فجر 18° / عشاء 17°)
            </p>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/muslim/ramadan"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground no-underline transition-colors hover:border-primary/40 hover:text-primary"
              >
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span>كل المحافظات</span>
              </Link>
              <Link
                href={`/muslim/prayer/${city.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary no-underline transition-colors hover:bg-primary/10"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>مواقيت الصلاة في {city.nameAr}</span>
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-2"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span>طباعة الإمساكية</span>
            </Button>
          </div>

          {/* SANA city photograph with visible credit */}
          {image && (
            <figure className="overflow-hidden rounded-xl border border-border bg-card/60 print:hidden">
              <div className="aspect-[16/7] max-h-80 w-full overflow-hidden bg-muted">
                <img
                  src={image.file}
                  alt={image.alt_ar}
                  width={image.width}
                  height={image.height}
                  loading="eager"
                  className="h-full w-full object-cover"
                />
              </div>
              <figcaption className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-muted-foreground">
                <span>{image.caption_ar}</span>
                <span>
                  الصورة:{' '}
                  <a
                    href={image.source_article_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`مصدر الصورة من الوكالة العربية السورية للأنباء (سانا): ${image.caption_ar}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    سانا
                  </a>
                </span>
              </figcaption>
            </figure>
          )}

          {/* Full Ramadan table */}
          <Card className="border-border bg-card/60 print:border-0 print:bg-transparent print:shadow-none">
            <CardContent className="p-4 sm:p-6 print:p-0">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <Calendar className="h-5 w-5 text-primary print:hidden" aria-hidden="true" />
                  <span>جدول رمضان 1448 هـ / 2027 م ({city.nameAr})</span>
                </h2>
                <span className="text-xs text-muted-foreground">
                  من {formatGregorianSyrianShort(meta.expected_start_date)} إلى {formatGregorianSyrianShort(meta.expected_end_date)}
                </span>
              </div>

              <Table>
                <caption className="sr-only">
                  إمساكية شهر رمضان المبارك 1448 هـ / 2027 م في {city.nameAr} بتوقيت دمشق
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="whitespace-nowrap">رمضان</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">التاريخ</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">اليوم</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">الإمساك</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">الفجر</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">الشروق</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">الظهر</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">العصر</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap text-primary">المغرب / الإفطار</TableHead>
                    <TableHead scope="col" className="whitespace-nowrap">العشاء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isToday = todayInfo.iso === row.date;
                    return (
                      <TableRow
                        key={row.hijri_day}
                        aria-current={isToday ? 'date' : undefined}
                        className={isToday ? 'bg-primary/10 font-bold hover:bg-primary/15' : undefined}
                      >
                        <TableCell className="whitespace-nowrap font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span>{row.hijri_day} رمضان</span>
                            {isToday && <Badge variant="secondary" className="text-[10px]">اليوم</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatGregorianSyrianShort(row.date)}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.weekday_ar}</TableCell>
                        <TableCell dir="ltr" className="font-mono tabular-nums whitespace-nowrap">{row.imsak}</TableCell>
                        <TableCell dir="ltr" className="font-mono tabular-nums whitespace-nowrap">{row.fajr}</TableCell>
                        <TableCell dir="ltr" className="font-mono tabular-nums whitespace-nowrap">{row.sunrise}</TableCell>
                        <TableCell dir="ltr" className="font-mono tabular-nums whitespace-nowrap">{row.dhuhr}</TableCell>
                        <TableCell dir="ltr" className="font-mono tabular-nums whitespace-nowrap">{row.asr}</TableCell>
                        <TableCell dir="ltr" className="font-mono font-bold tabular-nums whitespace-nowrap text-primary">{row.maghrib}</TableCell>
                        <TableCell dir="ltr" className="font-mono tabular-nums whitespace-nowrap">{row.isha}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Method, offsets, moon-sighting and official source note */}
          <Alert>
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <h2 className="font-semibold leading-none tracking-tight">ملاحظات الحساب وتحرّي الهلال</h2>
              <AlertDescription className="space-y-1.5">
                <p>
                  تُحسب المواقيت لإحداثيات {city.nameAr} وفق طريقة <strong>رابطة العالم الإسلامي</strong> (فجر 18° / عشاء 17°) بتوقيت دمشق (<span dir="ltr">{meta.timezone}</span>).
                  الإمساك احتياط يسبق أذان الفجر بعشر دقائق، بينما يبدأ الصيام شرعياً عند أذان الفجر.
                </p>
                <p>
                  تاريخ الغرة الفلكي المتوقع ({formatGregorianSyrianShort(meta.expected_start_date)}) يظل خاضعاً لإعلان تحرّي الهلال الرسمي في سوريا؛{' '}
                  <span>إزاحة الأيام الحالية: <span dir="ltr">{meta.day_offset}</span> · إزاحة الدقائق: <span dir="ltr">{meta.minute_offset}</span>.</span>
                  {meta.official_source_url && (
                    <>
                      {' '}
                      <a
                        href={meta.official_source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary underline underline-offset-4"
                      >
                        المصدر الرسمي
                      </a>
                    </>
                  )}
                </p>
              </AlertDescription>
            </div>
          </Alert>

          {/* Links to other governorates */}
          <nav aria-label="إمساكية رمضان في محافظات أخرى" className="rounded-xl border border-border/70 bg-card/50 p-4 print:hidden">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2>إمساكية رمضان في محافظات أخرى</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {otherCities.map((gov) => (
                <Link
                  key={gov.id}
                  href={`/muslim/ramadan/${gov.id}`}
                  className="rounded-lg border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {gov.nameAr}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </MuslimShell>
    </MainLayout>
  );
}
