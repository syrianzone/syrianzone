import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NearbyPlace } from '../_lib/types';

export function DuplicateSuggestions(props: {
  places: NearbyPlace[];
  onSelectExisting: (id: number) => void;
  onContinue: () => void;
}) {
  const { places, onSelectExisting, onContinue } = props;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">يوجد أماكن قريبة من النقطة المحددة</p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {places.map((place) => (
          <div key={place.id} className="flex items-center gap-3 rounded-md border border-border p-2">
            {place.thumb_url ? (
              <img src={place.thumb_url} alt={place.name} loading="lazy" className="h-12 w-12 rounded-md object-cover shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded-md bg-accent/50 flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{place.name}</p>
              <p className="text-xs text-muted-foreground">
                <span dir="ltr">{Math.round(place.distance_m)} م</span>
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onSelectExisting(place.id)}>
              هذا هو المكان
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" className="w-full" onClick={onContinue}>
        مكاني مختلف، متابعة
      </Button>
    </div>
  );
}
