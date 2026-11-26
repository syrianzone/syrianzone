import { useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { ArrowRight, Check, Copy, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/Components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/Components/ui/avatar';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { copyText } from '@/Lib/copy';
import { api } from '@/Domain/places/api';
import { apiErrorMessage } from '@/Lib/api';
import { CATEGORY_LABELS } from '@/Domain/places/categories';
import type { PlaceDetail } from '@/Domain/places/types';
import { EngagementBar } from './EngagementBar';
import { LevelBadge } from './LevelBadge';
import { PhotoGallery } from './PhotoGallery';

export function PlaceDetailView(props: { placeId: number; onClose: () => void }) {
  const { placeId, onClose } = props;
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPlace(null);
    setError(null);
    api.getPlace(placeId)
      .then((p) => {
        if (!cancelled) setPlace(p);
      })
      .catch((e) => {
        if (!cancelled) setError(apiErrorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  const copyCoords = async () => {
    if (!place) return;
    if (!await copyText(`${place.lat}, ${place.lng}`, { successMessage: 'تم نسخ الإحداثيات' })) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div dir="rtl" className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="رجوع">
          <ArrowRight className="h-4 w-4" />
        </Button>
        {/* PlacesPanel moves focus here when the detail replaces the list */}
        <p data-panel-title tabIndex={-1} className="min-w-0 flex-1 truncate font-medium text-foreground focus:outline-none">{place?.name ?? 'تفاصيل المكان'}</p>
        {place?.status === 'approved' && (
          <Link
            href={place.url}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-primary transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>صفحة المكان</span>
          </Link>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {place && (
          <>
            <PhotoGallery photos={place.photos} name={place.name} />
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{place.name}</h2>
              <Badge variant="secondary">{CATEGORY_LABELS[place.category]}</Badge>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {place.description}
            </p>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={place.user.avatar_url ?? undefined} alt={place.user.name} />
                <AvatarFallback>{place.user.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">{place.user.name}</span>
              <LevelBadge level={place.user.level} showLabel />
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span dir="ltr">
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
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {place.status === 'approved' ? (
              <EngagementBar
                key={place.id}
                placeId={place.id}
                placeName={place.name}
                placeUrl={place.url}
                lat={place.lat}
                lng={place.lng}
                initialSaved={place.saved_by_me}
                initialSaves={place.saves_count}
              />
            ) : (
              // engagement endpoints 404 for non-approved places, show the status instead
              <Badge variant={place.status === 'pending' ? 'secondary' : 'destructive'}>
                {place.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
              </Badge>
            )}
          </>
        )}
      </div>
    </div>
  );
}
