import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { PlacePhoto } from '../_lib/types';

export function PhotoGallery(props: { photos: PlacePhoto[]; name: string }) {
  const { photos, name } = props;
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => setActive(0), [photos]);

  if (photos.length === 0) return null;
  const current = photos[Math.min(active, photos.length - 1)];

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setLightbox(true)}
        className="block w-full cursor-zoom-in"
      >
        <img
          src={current.display_url}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-52 w-full rounded-md object-cover"
        />
      </button>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActive(i)}
              className={`shrink-0 rounded-md ${i === active ? 'ring-2 ring-primary' : ''}`}
            >
              <img
                src={photo.thumb_url}
                alt={name}
                loading="lazy"
                decoding="async"
                className="h-14 w-14 rounded-md object-cover"
              />
            </button>
          ))}
        </div>
      )}
      <Dialog open={lightbox} onOpenChange={setLightbox}>
        <DialogContent className="max-w-3xl p-2" dir="rtl">
          <DialogTitle className="sr-only">{name}</DialogTitle>
          <img
            src={current.display_url}
            alt={name}
            loading="lazy"
            decoding="async"
            className="max-h-[80dvh] w-full rounded-md object-contain"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
