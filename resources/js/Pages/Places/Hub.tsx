import { useState } from 'react';
import { Link } from '@inertiajs/react';
import {
  Bookmark,
  Camera,
  ChevronLeft,
  Church,
  Compass,
  Ghost,
  Landmark,
  MapPin,
  Mountain,
  Palette,
  Store,
  TreePine,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { MishwarIcon } from '@/Components/Icons/ProjectIcons';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import type { PlaceCategory, PlaceHubItem, PlaceHubProps } from '@/Domain/places/types';

const CATEGORY_ICONS: Record<PlaceCategory, LucideIcon> = {
  historical: Landmark,
  natural: TreePine,
  cultural: Palette,
  religious: Church,
  abandoned: Ghost,
  viewpoint: Mountain,
  market: Store,
  food: Utensils,
  other: MapPin,
};

function formatPhotosCount(count: number): string {
  if (count === 1) return 'صورة واحدة';
  if (count === 2) return 'صورتان';
  const rest = count % 100;
  if (rest >= 3 && rest <= 10) return `${count} صور`;
  return `${count} صورة`;
}

function PlaceHubCard({ place, index }: { place: PlaceHubItem; index: number }) {
  const [broken, setBroken] = useState(false);
  const Icon = CATEGORY_ICONS[place.category] ?? MapPin;

  return (
    <Link
      href={place.url}
      className="group flex h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="flex w-full flex-col overflow-hidden border-border bg-card/70 transition-all group-hover:border-primary/50 group-hover:shadow-sm">
        <div className="relative aspect-[3/2] w-full overflow-hidden bg-muted">
          {place.thumb_url && !broken ? (
            <img
              src={place.thumb_url}
              alt={place.name}
              width={480}
              height={320}
              loading={index < 3 ? 'eager' : 'lazy'}
              decoding="async"
              onError={() => setBroken(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted/70 text-muted-foreground">
              <Icon className="h-8 w-8" aria-hidden="true" />
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col justify-between gap-3 p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-1 text-base font-bold text-foreground transition-colors group-hover:text-primary">
                {place.name}
              </h3>
              <Badge variant="secondary" className="shrink-0 gap-1 text-[11px]">
                <Icon className="h-3 w-3" aria-hidden="true" />
                <span>{place.category_label}</span>
              </Badge>
            </div>

            {place.description && (
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {place.description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>{formatPhotosCount(place.photos_count)}</span>
            </span>

            {place.saves_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                <span dir="ltr" className="font-mono tabular-nums">
                  {place.saves_count}
                </span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function PlaceHub({
  governorate,
  category,
  h1,
  intro,
  total,
  mapUrl,
  governorateUrl,
  hubUrl,
  categories,
  places,
  otherHubs,
}: PlaceHubProps) {
  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Breadcrumb */}
        <nav aria-label="مسار التنقل" className="text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li className="flex items-center gap-1.5">
              <Link href="/mishwar" className="transition-colors hover:text-foreground">
                مشوار
              </Link>
              <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </li>
            {category ? (
              <>
                <li className="flex items-center gap-1.5">
                  <Link href={hubUrl} className="transition-colors hover:text-foreground">
                    {governorate.name_ar}
                  </Link>
                  <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </li>
                <li>
                  <span aria-current="page" className="font-medium text-foreground">
                    {category.label}
                  </span>
                </li>
              </>
            ) : (
              <li>
                <span aria-current="page" className="font-medium text-foreground">
                  {governorate.name_ar}
                </span>
              </li>
            )}
          </ol>
        </nav>

        {/* Header with Mishwar section chrome */}
        <header className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-card shadow-xs">
              <MishwarIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {h1}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {intro}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={mapUrl}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Compass className="h-4 w-4" aria-hidden="true" />
              <span>افتح {governorate.name_ar} على خريطة مشوار</span>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Link>

            {category && (
              <Button asChild variant="outline" className="gap-1.5">
                <Link href={hubUrl}>
                  <span>جميع الأماكن في {governorate.name_ar}</span>
                </Link>
              </Button>
            )}
          </div>
        </header>

        {/* Category chips on governorate hubs */}
        {!category && categories.length > 0 && (
          <section aria-labelledby="categories-heading" className="space-y-2.5">
            <h2 id="categories-heading" className="text-sm font-bold text-foreground">
              التصنيفات
            </h2>
            <ul className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.key] ?? MapPin;
                return (
                  <li key={cat.key}>
                    {cat.url ? (
                      <Link
                        href={cat.url}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        <span>{cat.label}</span>
                        <span dir="ltr" className="font-mono text-[11px] tabular-nums text-foreground/80">
                          ({cat.count})
                        </span>
                      </Link>
                    ) : (
                      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-foreground/80">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{cat.label}</span>
                        <span dir="ltr" className="font-mono text-[11px] tabular-nums">
                          ({cat.count})
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Places Grid */}
        <section aria-labelledby="places-grid-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="places-grid-heading" className="text-lg font-bold text-foreground">
              الأماكن المضافة
            </h2>
            <Badge variant="secondary" className="text-xs">
              <span dir="ltr" className="font-mono tabular-nums">
                {total}
              </span>
            </Badge>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {places.map((place, index) => (
              <li key={place.id} className="flex">
                <PlaceHubCard place={place} index={index} />
              </li>
            ))}
          </ul>
        </section>

        {/* Cross-links */}
        <section aria-labelledby="crosslinks-heading" className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="crosslinks-heading" className="text-base font-bold text-foreground">
              روابط ذات صلة
            </h2>
            <Link
              href={governorateUrl}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span>دليل محافظة {governorate.name_ar}</span>
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {otherHubs.length > 0 && (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <h3 className="text-xs font-semibold text-muted-foreground">
                أماكن سياحية في محافظات أخرى
              </h3>
              <ul className="flex flex-wrap gap-2">
                {otherHubs.map((hub) => (
                  <li key={hub.id}>
                    <Link
                      href={hub.url}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      <span>{hub.name_ar}</span>
                      <span dir="ltr" className="font-mono text-[11px] tabular-nums text-foreground/80">
                        ({hub.count})
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
