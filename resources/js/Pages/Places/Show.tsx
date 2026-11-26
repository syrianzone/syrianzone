import { useEffect, useMemo, useRef, useState } from 'react';
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
  PlaceLocatorShape,
} from '@/Domain/places/types';
import { copyText } from '@/Lib/copy';
import { cn } from '@/Lib/utils';
import { EngagementBar } from './_components/EngagementBar';
import { LevelBadge } from './_components/LevelBadge';
import { Lightbox } from './_components/Lightbox';
import { ReportButton } from './_components/ReportButton';

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

function formatRemainingPhotosWord(remaining: number): string {
  if (remaining === 1) return 'صورة';
  if (remaining === 2) return 'صورتان';
  if (remaining <= 10) return 'صور';
  return 'صورة';
}

function parseViewBox(viewBox: string): { x: number; y: number; width: number; height: number } {
  const parts = viewBox.trim().split(/\s+/).map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
    return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  }
  return { x: 0, y: 0, width: 600, height: 544 };
}

function labelHalfSize(nameAr: string, unitScale: number): { hw: number; hh: number } {
  // Calibrated against rendered Arabic SVG text at fontSize = 10 * unitScale (~300px SVG width).
  return {
    hw: Math.max(12, nameAr.length * 2.4 + 3) * unitScale,
    hh: 7.6 * unitScale,
  };
}

function boxesOverlap(
  ax: number,
  ay: number,
  ahw: number,
  ahh: number,
  bx: number,
  by: number,
  bhw: number,
  bhh: number,
): boolean {
  return Math.abs(ax - bx) < ahw + bhw && Math.abs(ay - by) < ahh + bhh;
}

function boxOverlapsCircle(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  px: number,
  py: number,
  radius: number,
): boolean {
  const nearestX = Math.max(cx - hw, Math.min(px, cx + hw));
  const nearestY = Math.max(cy - hh, Math.min(py, cy + hh));
  return Math.hypot(px - nearestX, py - nearestY) < radius;
}

function pickVisibleNeighbourLabels(
  shapes: PlaceLocatorShape[],
  highlightedId: string | null,
  vb: { x: number; y: number; width: number; height: number },
  pin: { x: number; y: number },
  unitScale: number,
  hasInset: boolean,
): PlaceLocatorShape[] {
  const minX = vb.x + vb.width * 0.02;
  const maxX = vb.x + vb.width * 0.98;
  const minY = vb.y + vb.height * 0.04;
  const maxY = vb.y + vb.height * 0.96;
  // In RTL `top-2 end-2` sits in the top-left of the SVG box.
  const insetMaxX = vb.x + vb.width * 0.27;
  const insetMaxY = vb.y + vb.height * 0.33;
  const pinClearRadius = 12 * unitScale;
  const labelPadX = 2 * unitScale;
  const labelPadY = 1 * unitScale;

  const placed: Array<{ x: number; y: number; hw: number; hh: number }> = [];
  const chosen: PlaceLocatorShape[] = [];

  for (const shape of shapes) {
    if (shape.id === highlightedId || shape.label_x === undefined || shape.label_y === undefined) {
      continue;
    }
    const lx = shape.label_x;
    const ly = shape.label_y;
    const { hw, hh } = labelHalfSize(shape.name_ar, unitScale);
    if (lx - hw < minX || lx + hw > maxX || ly - hh < minY || ly + hh > maxY) {
      continue;
    }
    if (hasInset && lx - hw < insetMaxX && ly - hh < insetMaxY) {
      continue;
    }
    if (boxOverlapsCircle(lx, ly, hw, hh, pin.x, pin.y, pinClearRadius)) {
      continue;
    }
    const collides = placed.some((p) =>
      boxesOverlap(lx, ly, hw + labelPadX, hh + labelPadY, p.x, p.y, p.hw, p.hh),
    );
    if (collides) {
      continue;
    }
    placed.push({ x: lx, y: ly, hw, hh });
    chosen.push(shape);
  }

  return chosen;
}

function galleryTileClass(count: number, index: number): string {
  if (count === 1) {
    return 'w-full aspect-[4/3] md:aspect-[16/9]';
  }
  const slideBase = 'w-[92%] shrink-0 snap-start aspect-[4/3] md:w-auto md:aspect-auto md:min-h-0';
  if (count === 2) {
    return cn(slideBase, index === 0 ? 'md:col-span-2 md:h-full' : 'md:col-span-1 md:h-full');
  }
  if (index === 0) {
    return cn(slideBase, 'md:col-span-2 md:row-span-2 md:h-full');
  }
  if (index === 1 || index === 2) {
    return cn(slideBase, 'relative md:col-span-1 md:row-span-1 md:h-full');
  }
  return cn(slideBase, 'md:hidden');
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
  const [activeSlide, setActiveSlide] = useState(0);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveSlide(0);
    const root = carouselRef.current;
    if (!root || place.photos.length <= 1 || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-slide-index]'));
    if (slides.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestIndex: number | null = null;
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            const raw = (entry.target as HTMLElement).dataset.slideIndex;
            if (raw !== undefined) {
              bestRatio = entry.intersectionRatio;
              bestIndex = Number(raw);
            }
          }
        }
        if (bestIndex !== null && bestRatio >= 0.5) {
          setActiveSlide(bestIndex);
        }
      },
      { root, threshold: [0.5, 0.75, 0.9] },
    );

    for (const slide of slides) observer.observe(slide);
    return () => observer.disconnect();
  }, [place.id, place.photos.length]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handlePhotoClick = (index: number) => {
    const remaining = place.photos.length - 3;
    if (
      index === 2
      && remaining > 0
      && typeof window !== 'undefined'
      && window.matchMedia('(min-width: 768px)').matches
    ) {
      openLightbox(3);
      return;
    }
    openLightbox(index);
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
  const remainingPhotos = Math.max(0, place.photos.length - 3);

  const locatorMeta = useMemo(() => {
    if (!locator) return null;
    const vb = parseViewBox(locator.viewBox);
    const unitScale = vb.width / 300;
    const showInset = Boolean(
      locator.fullViewBox && locator.fullViewBox !== locator.viewBox && vb.width < 460,
    );
    const neighbourLabels = pickVisibleNeighbourLabels(
      locator.shapes,
      governorate?.id ?? null,
      vb,
      locator.pin,
      unitScale,
      showInset,
    );
    return { vb, unitScale, showInset, neighbourLabels };
  }, [locator, governorate?.id]);

  return (
    <MainLayout>
      <div className="min-h-screen bg-background pb-16" dir="rtl">
        {/* 1 & 2: Breadcrumb + H1 and badges */}
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
          </div>
        </section>

        {/* Main body: CSS order switches between mobile sequence and desktop 2-col layout */}
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            {/* 3 (mobile) / row 1 (desktop): Actions */}
            <div className="order-3 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center lg:order-1 lg:col-span-3">
              <Button asChild size="default" className="w-full gap-2 font-semibold shadow-xs sm:w-auto">
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
                variant="page"
                directionsLabel="الاتجاهات في خرائط Google"
              />
            </div>

            {/* 3 (mobile) / row 2 (desktop): Photos Gallery */}
            {place.photos.length > 0 && (
              <section
                aria-label="صور المكان"
                aria-roledescription={place.photos.length > 1 ? 'carousel' : undefined}
                className="order-1 lg:order-2 lg:col-span-3"
              >
                <div className="relative">
                  <div
                    ref={carouselRef}
                    className={cn(
                      place.photos.length === 1
                        ? 'block'
                        : place.photos.length === 2
                          ? 'flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:h-[420px] md:grid-cols-3 md:overflow-visible'
                          : 'flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:h-[420px] md:grid-cols-3 md:grid-rows-2 md:overflow-visible',
                    )}
                  >
                    {place.photos.map((photo, index) => {
                      const alt = photoAlt(place.name, governorate, index);
                      const isFirst = index === 0;
                      const showMoreOverlay = index === 2 && remainingPhotos > 0;
                      return (
                        <button
                          key={photo.id}
                          type="button"
                          data-slide-index={index}
                          onClick={() => handlePhotoClick(index)}
                          aria-label={`صورة ${index + 1} من ${place.photos.length} — ${alt}`}
                          className={cn(
                            'group block cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                            galleryTileClass(place.photos.length, index),
                          )}
                        >
                          <img
                            src={photo.display_url}
                            alt={alt}
                            width={isFirst ? 1200 : 600}
                            height={isFirst ? 800 : 450}
                            loading={isFirst ? 'eager' : 'lazy'}
                            fetchPriority={isFirst ? 'high' : 'auto'}
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                          {showMoreOverlay && (
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 hidden items-center justify-center gap-1.5 bg-background/70 text-lg font-bold text-foreground backdrop-blur-[2px] transition-colors group-hover:bg-background/55 md:flex"
                            >
                              <span dir="ltr" className="tabular-nums">+{remainingPhotos}</span>
                              <span>{formatRemainingPhotosWord(remainingPhotos)}</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {place.photos.length > 1 && (
                    <div
                      dir="ltr"
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-3 end-3 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium tabular-nums text-foreground shadow-sm ring-1 ring-border/60 md:hidden"
                    >
                      {activeSlide + 1} / {place.photos.length}
                    </div>
                  )}
                </div>

                <Lightbox
                  photos={place.photos}
                  name={place.name}
                  index={lightboxIndex}
                  open={lightboxOpen}
                  onOpenChange={setLightboxOpen}
                />
              </section>
            )}

            {/* Primary Column on desktop; `contents` on mobile so Actions + Location sit between Description and Contributor */}
            <div className="contents lg:order-3 lg:col-span-2 lg:block lg:space-y-6">
              {/* 4: Description */}
              <Card className="order-2 border-border/70">
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

                  <div className="flex justify-end border-t border-border/50 pt-2">
                    <ReportButton placeId={place.id} muted />
                  </div>
                </CardContent>
              </Card>

              {/* 7 (mobile) / under description (desktop): Contributor credit */}
              <Card className="order-5 border-border/70">
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

            {/* 6 (mobile) / sidebar (desktop): Location */}
            <aside className="order-4 space-y-6 lg:order-4 lg:col-span-1">
              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <Compass className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>الموقع</span>
                  </h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  {locator && locatorMeta && (
                    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/30">
                      <svg
                        viewBox={locator.viewBox}
                        role="img"
                        aria-label={
                          governorate
                            ? `موقع ${place.name} في محافظة ${governorate.name_ar} على خريطة سوريا`
                            : `موقع ${place.name} على خريطة سوريا`
                        }
                        className="block h-auto w-full select-none"
                      >
                        {locator.shapes.map((shape) => {
                          const isHighlighted = governorate !== null && shape.id === governorate.id;
                          return (
                            <path
                              key={shape.id}
                              d={shape.path}
                              className={
                                isHighlighted
                                  ? 'fill-primary/25 stroke-primary'
                                  : 'fill-muted/70 stroke-border'
                              }
                              strokeWidth={isHighlighted ? 1.75 : 1}
                              strokeLinejoin="round"
                              vectorEffect="non-scaling-stroke"
                            />
                          );
                        })}

                        {locatorMeta.neighbourLabels.map((shape) => (
                          <text
                            key={`label-${shape.id}`}
                            x={shape.label_x}
                            y={shape.label_y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            aria-hidden="true"
                            fontSize={10 * locatorMeta.unitScale}
                            className="pointer-events-none fill-muted-foreground/85 font-medium"
                          >
                            {shape.name_ar}
                          </text>
                        ))}

                        <g aria-hidden="true">
                          <circle
                            cx={locator.pin.x}
                            cy={locator.pin.y}
                            r={11 * locatorMeta.unitScale}
                            className="fill-primary/20"
                          />
                          <circle
                            cx={locator.pin.x}
                            cy={locator.pin.y}
                            r={5.5 * locatorMeta.unitScale}
                            className="fill-primary stroke-background"
                            strokeWidth={2.5}
                            vectorEffect="non-scaling-stroke"
                          />
                        </g>
                      </svg>

                      {locatorMeta.showInset && locator.fullViewBox && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute top-2 end-2 w-14 rounded-md border border-border/70 bg-background/90 p-1 shadow-xs"
                        >
                          <svg viewBox={locator.fullViewBox} className="block h-auto w-full">
                            {locator.shapes.map((shape) => (
                              <path
                                key={`inset-${shape.id}`}
                                d={shape.path}
                                className={
                                  governorate !== null && shape.id === governorate.id
                                    ? 'fill-primary/35 stroke-none'
                                    : 'fill-muted stroke-border/60'
                                }
                                strokeWidth={0.5}
                                vectorEffect="non-scaling-stroke"
                              />
                            ))}
                            <rect
                              x={locatorMeta.vb.x}
                              y={locatorMeta.vb.y}
                              width={locatorMeta.vb.width}
                              height={locatorMeta.vb.height}
                              className="fill-primary/10 stroke-primary"
                              strokeWidth={1.25}
                              vectorEffect="non-scaling-stroke"
                            />
                          </svg>
                        </div>
                      )}
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
                          className="h-9 w-9"
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

            {/* 8: Nearby Places */}
            {nearby.length > 0 && (
              <section aria-labelledby="nearby-places-heading" className="order-6 space-y-4 pt-2 lg:order-5 lg:col-span-3">
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
      </div>
    </MainLayout>
  );
}
