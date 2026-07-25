import { useState } from 'react';
import {
  Bookmark,
  Church,
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
import { CATEGORY_LABELS } from '../_lib/categories';
import type { PlaceCategory, PlaceListItem } from '../_lib/types';

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

export function PlaceCard(props: { place: PlaceListItem; onClick: (id: number, lat: number, lng: number) => void }) {
  const { place, onClick } = props;
  const [broken, setBroken] = useState(false);
  const Icon = CATEGORY_ICONS[place.category];

  return (
    <button
      type="button"
      onClick={() => onClick(place.id, place.lat, place.lng)}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-right transition-colors hover:bg-accent/50"
    >
      {place.thumb_url && !broken ? (
        <img
          src={place.thumb_url}
          alt={place.name}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-12 w-12 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent/50 text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{place.name}</p>
        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{CATEGORY_LABELS[place.category]}</span>
          <span className="flex items-center gap-1">
            <Bookmark className="h-3 w-3" />
            <span dir="ltr">{place.saves_count}</span>
          </span>
        </p>
      </div>
    </button>
  );
}
