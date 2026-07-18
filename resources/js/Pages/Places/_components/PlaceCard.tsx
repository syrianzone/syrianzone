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
import { Badge } from '@/Components/ui/badge';
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

export function PlaceCard(props: { place: PlaceListItem; onClick: (id: number) => void }) {
  const { place, onClick } = props;
  const [broken, setBroken] = useState(false);
  const Icon = CATEGORY_ICONS[place.category];

  return (
    <button
      type="button"
      onClick={() => onClick(place.id)}
      className="flex w-full items-center gap-3 rounded-md border border-border bg-card p-2 text-right transition-colors hover:bg-accent/50"
    >
      {place.thumb_url && !broken ? (
        <img
          src={place.thumb_url}
          alt={place.name}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-16 w-16 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-accent/50 text-muted-foreground">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{place.name}</p>
        <Badge variant="secondary" className="mt-1">{CATEGORY_LABELS[place.category]}</Badge>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Bookmark className="h-3.5 w-3.5" />
            <span dir="ltr">{place.saves_count}</span>
          </span>
        </div>
      </div>
    </button>
  );
}
