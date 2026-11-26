import { useState } from 'react';
import { Link } from '@inertiajs/react';
import {
  Check,
  ChevronLeft,
  Compass,
  Copy,
  Info,
  Map,
  MapPin,
  Navigation,
} from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { MishwarIcon } from '@/Components/Icons/ProjectIcons';
import { Avatar, AvatarFallback, AvatarImage } from '@/Components/ui/avatar';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader } from '@/Components/ui/card';
import { CATEGORY_LABELS } from '@/Domain/places/categories';
import type {
  NearbyPlace,
  PlaceDetail,
  PlaceGovernorate,
  PlaceLocator,
} from '@/Domain/places/types';
import { copyText } from '@/Lib/copy';
import { EngagementBar } from './_components/EngagementBar';
import { LevelBadge } from './_components/LevelBadge';
import { Lightbox } from './_components/Lightbox';

export interface PlaceShowProps {
  place: PlaceDetail;
  governorate: PlaceGovernorate | null;
  isThin: boolean;
  isOwner: boolean;
  locator: PlaceLocator | null;
  nearby: NearbyPlace[];
}

function photoAlt(placeName: string, governorate: PlaceGovernorate | null, index: number): string {
  const n = index + 1;
  return governorate
    ? `${placeName} في ${governorate.name_ar} — صورة ${n}`
    : `${placeName} — صورة ${n}`;
}

function formatDistanceKm(distanceMeters: number): string {
  const km = distanceMeters / 1000;
  return km < 10 ? km.toFixed(1) : Math.round(km).toString();
}

export default function PlaceShow({
  place,
  governorate,
  isThin,
  isOwner,
  locator,
  nearby,
}: PlaceShowProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [copiedCoords, setCopiedCoords] = useState(false);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const copyCoords = async () => {
    if (!await copyText(`${place.lat}, ${place.lng}`, { successMessage: 'تم نسخ الإحداثيات' })) {
      return;
    }
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 1500);
  };

  const mapUrl = `/mishwar?place=${place.id}`;
  const contributorUrl = `/mishwar?guide=${place.user.id}`;
  const categoryLabel = CATEGORY_LABELS[place.category] ?? place.category;

  return (
    <MainLayout>
      <div className="min-h-screen bg-background pb-16" dir="rtl">
        {/* Section header & breadcrumb */}
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
            <nav aria-label="مسار التنقل" className="mb-4 text-xs text-muted-foreground">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li className="flex items-center gap-1.5">
                  <Link href="/mishwar" className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-foreground">
                    <MishwarIcon className="h-4 w-4 shrink-0" />
                    <span>مشوار</span>
                  </Link>
                  <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </li>
                {governorate && (
                  <li className="flex items-center gap-1.5">
                    <Link
                      href={`/mishwar/${governorate.id}`}
                      className="transition-colors hover:text-foreground"
                    >
                      {governorate.name_ar}
                    </Link>
                    <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </li>
                )}
                <li className="min-w-0">
                  <span aria-current="page" className="block truncate font-medium text-foreground">
                    {place.name}
                  </span>
                </li>
              </ol>
            </nav>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {place.name}
                </h1>
                <Badge variant="secondary" className="text-xs font-medium">
                  {categoryLabel}
                </Badge>
                {governorate && (
                  <Link
                    href={`/governorates/${governorate.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    <span>{governorate.name_ar}</span>
                  </Link>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button asChild size="default" className="gap-2 font-semibold shadow-xs">
                  <Link href={mapUrl}>
                    <Map className="h-4 w-4" aria-hidden="true" />
                    <span>افتحه على خريطة مشوار</span>
                  </Link>
                </Button>

                <EngagementBar
                  key={place.id}
                  placeId={place.id}
                  placeName={place.name}
                  placeUrl={place.url}
                  lat={place.lat}
                  lng={place.lng}
                  initialSaved={place.saved_by_me}
                  initialSaves={place.saves_count}
                  directionsLabel="الاتجاهات في خرائط Google"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Main body */}
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
          {/* Photos Gallery */}
          {place.photos.length > 0 && (
            <section aria-label="صور المكان" className="space-y-3">
              {place.photos.length === 1 ? (
                <button
                  type="button"
                  onClick={() => openLightbox(0)}
                  aria-label={`عرض ${photoAlt(place.name, governorate, 0)} مكبّرة`}
                  className="group block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <img
                    src={place.photos[0].display_url}
                    alt={photoAlt(place.name, governorate, 0)}
                    width={1200}
                    height={800}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className="aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                  />
                </button>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {place.photos.map((photo, index) => {
                    const alt = photoAlt(place.name, governorate, index);
                    const isFirst = index === 0;
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => openLightbox(index)}
                        aria-label={`عرض ${alt} مكبّرة`}
                        className={`group block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                          isFirst ? 'sm:col-span-2 lg:col-span-2' : ''
                        }`}
                      >
                        <img
                          src={photo.display_url}
                          alt={alt}
                          width={isFirst ? 1200 : 600}
                          height={isFirst ? 800 : 450}
                          loading={isFirst ? 'eager' : 'lazy'}
                          fetchPriority={isFirst ? 'high' : 'auto'}
                          decoding="async"
                          className={`w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] ${
                            isFirst ? 'aspect-[16/10] sm:h-full' : 'aspect-[4/3]'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              <Lightbox
                photos={place.photos}
                name={place.name}
                index={lightboxIndex}
                open={lightboxOpen}
                onOpenChange={setLightboxOpen}
              />
            </section>
          )}

          {/* Content + Sidebar */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            {/* Primary Column */}
            <div className="space-y-6 lg:col-span-2">
              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <Info className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <span>عن المكان</span>
                  </h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground sm:text-base">
                    {place.description}
                  </p>

                  {isThin && (
                    <p className="rounded-xl border border-border/60 bg-muted/40 p-3.5 text-xs leading-relaxed text-muted-foreground">
                      {isOwner
                        ? 'وصف هذا المكان مختصر حالياً؛ يمكنك إضافة تفاصيل أوفى أو صور إضافية من تبويب «مساهماتي» في خريطة مشوار لجعل الصفحة أغنى للزوار.'
                        : 'المعلومات المتوفرة عن هذا المكان ما تزال مختصرة؛ إضافة وصف أوفى أو صور إضافية تجعل الصفحة أكثر فائدة للزوار.'}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Contributor credit */}
              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <h2 className="text-base font-bold text-foreground">أُضيف بواسطة</h2>
                </CardHeader>
                <CardContent>
                  <Link
                    href={contributorUrl}
                    className="group flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 transition-colors hover:border-primary/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={place.user.avatar_url ?? undefined} alt={place.user.name} />
                      <AvatarFallback>{place.user.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                          {place.user.name}
                        </span>
                        <LevelBadge level={place.user.level} showLabel />
                      </div>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        عرض مساهمات المرشد على خريطة مشوار
                      </span>
                    </div>
                    <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar: Location */}
            <aside className="space-y-6">
              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <Compass className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>الموقع</span>
                  </h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  {locator && (
                    <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/30 p-2">
                      <svg
                        viewBox={locator.viewBox}
                        role="img"
                        aria-label={
                          governorate
                            ? `موقع ${place.name} في محافظة ${governorate.name_ar} على خريطة سوريا`
                            : `موقع ${place.name} على خريطة سوريا`
                        }
                        className="h-auto w-full select-none"
                      >
                        {locator.shapes.map((shape) => {
                          const isHighlighted = governorate !== null && shape.id === governorate.id;
                          return (
                            <path
                              key={shape.id}
                              d={shape.path}
                              className={
                                isHighlighted
                                  ? 'fill-primary/30 stroke-primary'
                                  : 'fill-muted stroke-border'
                              }
                              strokeWidth={isHighlighted ? 2 : 1}
                              strokeLinejoin="round"
                            />
                          );
                        })}
                        <g aria-hidden="true">
                          <circle
                            cx={locator.pin.x}
                            cy={locator.pin.y}
                            r={12}
                            className="fill-primary/25"
                          />
                          <circle
                            cx={locator.pin.x}
                            cy={locator.pin.y}
                            r={5.5}
                            className="fill-primary stroke-background"
                            strokeWidth={2}
                          />
                        </g>
                      </svg>
                    </div>
                  )}

                  <div className="space-y-2 text-sm">
                    {governorate && (
                      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">المحافظة</span>
                        <Link
                          href={`/governorates/${governorate.id}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {governorate.name_ar}
                        </Link>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">الإحداثيات</span>
                      <div className="flex items-center gap-1">
                        <span dir="ltr" className="font-mono text-xs tabular-nums text-foreground">
                          {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={copyCoords}
                          aria-label="نسخ الإحداثيات"
                        >
                          {copiedCoords ? (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {governorate && (
                <Card className="border-border/70">
                  <CardContent className="p-4">
                    <Button asChild variant="outline" className="w-full justify-between gap-2">
                      <Link href={`/mishwar/${governorate.id}`}>
                        <span>المزيد في {governorate.name_ar}</span>
                        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </aside>
          </div>

          {/* Nearby Places */}
          {nearby.length > 0 && (
            <section aria-labelledby="nearby-places-heading" className="space-y-4 pt-2">
              <div className="flex items-center justify-between gap-2">
                <h2 id="nearby-places-heading" className="flex items-center gap-2 text-lg font-bold text-foreground sm:text-xl">
                  <Navigation className="h-5 w-5 text-primary" aria-hidden="true" />
                  <span>أماكن قريبة</span>
                </h2>
                <Link href={mapUrl} className="text-xs font-medium text-primary hover:underline">
                  استكشاف على الخريطة
                </Link>
              </div>

              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {nearby.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.url}
                      className="group flex h-full items-center gap-3 rounded-xl border border-border/70 bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {item.thumb_url ? (
                        <img
                          src={item.thumb_url}
                          alt=""
                          width={64}
                          height={64}
                          loading="lazy"
                          decoding="async"
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <MapPin className="h-5 w-5" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-bold text-foreground group-hover:text-primary">
                          {item.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-[11px] font-normal">
                            {CATEGORY_LABELS[item.category] ?? item.category}
                          </Badge>
                          <span className="inline-flex items-center gap-1">
                            <span dir="ltr" className="font-mono tabular-nums">
                              {formatDistanceKm(item.distance_m)}
                            </span>
                            <span>كم</span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
