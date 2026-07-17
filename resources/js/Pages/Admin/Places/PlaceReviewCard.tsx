import { useRef, useState } from 'react';
import { Check, ExternalLink, Loader2, RotateCw, Trash2, Upload, X } from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { api, extractError } from '../../Places/_lib/api';
import { CATEGORY_LABELS } from '../../Places/_lib/categories';
import type { AdminPlace, PlaceStatus } from '../../Places/_lib/types';

const STATUS_LABELS: Record<PlaceStatus, string> = {
  pending: 'قيد الانتظار',
  approved: 'مقبول',
  rejected: 'مرفوض',
};

const STATUS_VARIANTS: Record<PlaceStatus, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

export function PlaceReviewCard(props: {
  place: AdminPlace;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const { place, onApprove, onReject, onDelete } = props;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`;
  // fixed photos get fresh versioned urls; keyed here so the img swaps without a refetch
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
  const [busyPhoto, setBusyPhoto] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<number | null>(null);

  async function rotate(photoId: number) {
    setBusyPhoto(photoId);
    setPhotoError(null);
    try {
      const res = await api.adminRotatePhoto(photoId);
      setPhotoUrls((prev) => ({ ...prev, [photoId]: res.thumb_url }));
    } catch (e) {
      setPhotoError(extractError(e));
    } finally {
      setBusyPhoto(null);
    }
  }

  function pickReplacement(photoId: number) {
    replaceTargetRef.current = photoId;
    fileInputRef.current?.click();
  }

  async function replaceSelected(file: File | undefined) {
    const photoId = replaceTargetRef.current;
    if (!file || photoId === null) return;
    setBusyPhoto(photoId);
    setPhotoError(null);
    try {
      const res = await api.adminReplacePhoto(photoId, file);
      setPhotoUrls((prev) => ({ ...prev, [photoId]: res.thumb_url }));
    } catch (e) {
      setPhotoError(extractError(e));
    } finally {
      setBusyPhoto(null);
      replaceTargetRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => replaceSelected(e.target.files?.[0])}
        />
        {place.photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {place.photos.map((photo) => (
              <div key={photo.id} className="relative shrink-0">
                <img
                  src={photoUrls[photo.id] ?? photo.thumb_url}
                  alt={place.name}
                  loading="lazy"
                  className="h-24 w-24 rounded-md object-cover"
                />
                {busyPhoto === photo.id ? (
                  <span className="absolute bottom-1 left-1 rounded-md bg-background/80 p-1 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </span>
                ) : (
                  <span className="absolute bottom-1 left-1 flex gap-1">
                    <button
                      type="button"
                      aria-label="تدوير الصورة"
                      title="تدوير الصورة ٩٠ درجة"
                      onClick={() => rotate(photo.id)}
                      className="rounded-md bg-background/80 p-1 text-foreground shadow-sm hover:bg-background"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="إعادة رفع الصورة"
                      title="إعادة رفع الصورة"
                      onClick={() => pickReplacement(photo.id)}
                      className="rounded-md bg-background/80 p-1 text-foreground shadow-sm hover:bg-background"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {photoError && <p className="text-sm text-destructive">{photoError}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold">{place.name}</h3>
          <Badge variant="outline">{CATEGORY_LABELS[place.category]}</Badge>
          <Badge variant={STATUS_VARIANTS[place.status]}>{STATUS_LABELS[place.status]}</Badge>
        </div>

        <p className="text-sm text-muted-foreground">{place.description}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {place.user.avatar_url && (
              <img src={place.user.avatar_url} alt="" className="h-5 w-5 rounded-full" />
            )}
            {place.user.name}
          </span>
          <a
            href={osmUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            <span dir="ltr">
              {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
            </span>
          </a>
          <span>{new Date(place.created_at).toLocaleDateString('ar-SY')}</span>
        </div>

        {place.status === 'rejected' && place.rejection_reason && (
          <p className="text-sm text-destructive">سبب الرفض: {place.rejection_reason}</p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {place.status === 'pending' && (
            <>
              <Button size="sm" onClick={() => onApprove(place.id)}>
                <Check className="h-4 w-4" />
                موافقة
              </Button>
              <Button size="sm" variant="outline" onClick={() => onReject(place.id)}>
                <X className="h-4 w-4" />
                رفض
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(place.id)}>
            <Trash2 className="h-4 w-4" />
            حذف
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
