import { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { api, extractError } from '../_lib/api';
import { CATEGORY_LABELS } from '../_lib/categories';
import type { PlaceDetail } from '../_lib/types';
import { CommentsSection } from './CommentsSection';
import { EngagementBar } from './EngagementBar';
import { PhotoGallery } from './PhotoGallery';
import { ReportButton } from './ReportButton';

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
        if (!cancelled) setError(extractError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  const copyCoords = async () => {
    if (!place) return;
    try {
      await navigator.clipboard.writeText(`${place.lat}, ${place.lng}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable, nothing to recover
    }
  };

  return (
    <div dir="rtl" className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="رجوع">
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="truncate font-medium text-foreground">{place?.name ?? 'تفاصيل المكان'}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!place && !error && (
          <div className="animate-pulse space-y-3">
            <div className="h-52 rounded-md bg-accent/50" />
            <div className="h-5 w-2/3 rounded bg-accent/50" />
            <div className="h-4 w-full rounded bg-accent/50" />
            <div className="h-4 w-1/2 rounded bg-accent/50" />
          </div>
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
              <>
                <div className="flex items-center justify-between gap-2">
                  <EngagementBar
                    key={place.id}
                    placeId={place.id}
                    initialLiked={place.liked_by_me}
                    initialSaved={place.saved_by_me}
                    initialLikes={place.likes_count}
                    initialSaves={place.saves_count}
                    commentsCount={place.comments_count}
                  />
                  <ReportButton placeId={place.id} />
                </div>
                <Separator />
                <CommentsSection placeId={place.id} />
              </>
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
