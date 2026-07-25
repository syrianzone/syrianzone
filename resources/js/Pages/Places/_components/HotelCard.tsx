import { useState } from 'react';
import { Hotel, Star } from 'lucide-react';
import type { HotelListItem } from '../_lib/types';

export function HotelCard(props: { hotel: HotelListItem; onClick: (id: number) => void }) {
  const { hotel, onClick } = props;
  const [broken, setBroken] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onClick(hotel.id)}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-right transition-colors hover:bg-accent/50"
    >
      {hotel.thumb_url && !broken ? (
        <img
          src={hotel.thumb_url}
          alt={hotel.name}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-12 w-12 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent/50 text-muted-foreground">
          <Hotel className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{hotel.name_ar ?? hotel.name}</p>
        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          {hotel.star_rating && (
            <span className="flex items-center gap-0.5">
              {hotel.star_rating}
              <Star className="h-3 w-3 fill-current" />
            </span>
          )}
          <span>{hotel.city_ar ?? hotel.city}</span>
          {hotel.now_show_rate != null && (
            <span dir="ltr" className="ms-auto font-medium text-foreground">
              ${hotel.now_show_rate}
            </span>
          )}
        </p>
      </div>
    </button>
  );
}
