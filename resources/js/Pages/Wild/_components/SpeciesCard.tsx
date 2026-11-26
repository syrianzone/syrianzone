import { memo } from 'react';
import { Link } from '@inertiajs/react';
import { GROUP_LABEL_ONE, imageSrcSet, imageUrl, type SpeciesCardData } from '@/Domain/wildlife/wildlife';
import { IucnBadge, StatusBadge } from './Badges';

/** The card's rendered width: one column on phones, up to four on wide screens. */
const CARD_SIZES = '(min-width: 1280px) 272px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw';

/**
 * One species in the guide's grid: photo, names and the two statuses.
 * `priority` marks a card above the fold, whose photo should not wait for lazy loading.
 */
export const SpeciesCard = memo(function SpeciesCard({
    species,
    priority = false,
}: {
    species: SpeciesCardData;
    priority?: boolean;
}) {
    return (
        <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:border-foreground/25 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background">
            <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                    src={imageUrl(species.image, 500)}
                    srcSet={imageSrcSet(species.image)}
                    sizes={CARD_SIZES}
                    alt=""
                    width={500}
                    height={375}
                    loading={priority ? 'eager' : 'lazy'}
                    fetchPriority={priority ? 'high' : 'auto'}
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{GROUP_LABEL_ONE[species.group]}</p>
                    <h3 className="text-base font-bold leading-snug text-foreground">
                        {/* The whole card is the link target; the name carries its accessible label. */}
                        <Link
                            href={`/wild/${species.slug}`}
                            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                        >
                            {species.nameAr}
                        </Link>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        <span className="italic" dir="ltr" lang="la">
                            {species.subspecies ?? species.scientific}
                        </span>
                    </p>
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5">
                    <IucnBadge category={species.iucn.category} />
                    <StatusBadge status={species.syriaStatus} />
                </div>
            </div>
        </li>
    );
});
