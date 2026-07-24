import { MapPin } from 'lucide-react';
import { api } from '@/Pages/Places/_lib/api';
import { WidgetShell } from '../../_components/WidgetShell';
import { useGeo } from '../../_components/GeoProvider';
import { useWidgetQuery } from '../../_lib/query';
import type { WidgetProps } from '../../_lib/types';
import { placesNearbyWidget, type PlacesNearbyConfig } from './index';

// BoardTile guarantees a granted fix before this mounts, so coords are present.
export default function PlacesNearbyView({ config }: WidgetProps<PlacesNearbyConfig>) {
  const { coords } = useGeo();
  const radius = Math.min(Math.max(Number(config.radius_km) || 10, 1), 25);

  const query = useWidgetQuery(
    placesNearbyWidget,
    [coords?.lat, coords?.lng, radius],
    () => api.nearby({ lat: coords!.lat, lng: coords!.lng, radius_km: radius }),
  );

  const places = query.data?.places ?? [];

  return (
    <WidgetShell
      title="أماكن قريبة"
      icon={MapPin}
      loading={query.isPending}
      refreshing={query.isFetching && !query.isPending}
      error={query.isError ? 'تعذر تحميل الأماكن' : null}
      onRetry={() => query.refetch()}
      empty={!query.isPending && !query.isError && places.length === 0}
      emptyText="لا توجد أماكن ضمن هذا النطاق"
    >
      <ul className="divide-y divide-border">
        {places.map((p) => (
          <li key={p.id}>
            <a href={`/mishwar?place=${p.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.category}</p>
              </div>
              <span dir="ltr" className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {(p.distance_m / 1000).toFixed(1)} كم
              </span>
            </a>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
