import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, RotateCw, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, extractError, extractFieldErrors } from '../_lib/api';
import { CATEGORIES } from '../_lib/categories';
import type { LatLng, MyPlace, PlaceCategory, PlaceDetail, PlacePhoto, PlaceStatus } from '../_lib/types';
import { parseLatLng } from './FilterBar';
import { MAX_BYTES, MAX_DIM, MIN_DIM, imageDimensions } from './PhotoPicker';

// client mirror of the server's Syria bounding box
const inSyriaBox = (p: LatLng) => p.lat >= 32.0 && p.lat <= 37.5 && p.lng >= 35.5 && p.lng <= 42.5;

const STATUS_LABELS: Record<PlaceStatus, string> = {
  pending: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
};

const STATUS_VARIANTS: Record<PlaceStatus, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

type Feedback =
  | { kind: 'invalid' }
  | { kind: 'outside' }
  | { kind: 'valid'; point: LatLng }
  | null;

export function ManagePlaceDialog(props: {
  place: MyPlace | null; // null = closed
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void; // caller reloads the mine list
}) {
  const { place, onOpenChange, onUpdated } = props;

  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [status, setStatus] = useState<PlaceStatus>('pending');

  // section 1: details
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [description, setDescription] = useState('');
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsFieldErrors, setDetailsFieldErrors] = useState<Record<string, string>>({});
  const [detailsDone, setDetailsDone] = useState(false);

  // section 2: photos
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [busyPhoto, setBusyPhoto] = useState<number | null>(null);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // section 3: location
  const [coords, setCoords] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationDone, setLocationDone] = useState(false);

  // section 4: danger
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!place) return;
    setDetail(null);
    setLoadFailed(false);
    setStatus(place.status);
    setName('');
    setCategory(null);
    setDescription('');
    setDetailsSaving(false);
    setDetailsError(null);
    setDetailsFieldErrors({});
    setDetailsDone(false);
    setPhotos([]);
    setBusyPhoto(null);
    setAddingPhoto(false);
    setPhotoError(null);
    setCoords(`${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`);
    setFeedback(null);
    setLocationSaving(false);
    setLocationError(null);
    setLocationDone(false);
    setDeleting(false);
    setDeleteError(null);
    let cancelled = false;
    api.getPlace(place.id)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setStatus(d.status);
        setName(d.name);
        setCategory(d.category);
        setDescription(d.description);
        setPhotos(d.photos);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [place]);

  // debounce validation; feedback null means still typing, save stays disabled
  useEffect(() => {
    setFeedback(null);
    const timer = window.setTimeout(() => {
      const parsed = parseLatLng(coords.trim());
      if (!parsed) setFeedback({ kind: 'invalid' });
      else if (!inSyriaBox(parsed)) setFeedback({ kind: 'outside' });
      else setFeedback({ kind: 'valid', point: parsed });
    }, 250);
    return () => window.clearTimeout(timer);
    // place is a dep so reopening with an identical prefill string still revalidates
  }, [coords, place]);

  const point = feedback?.kind === 'valid' ? feedback.point : null;

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const changes: Partial<{ name: string; category: PlaceCategory; description: string }> = {};
  if (detail) {
    if (trimmedName !== detail.name) changes.name = trimmedName;
    if (category !== null && category !== detail.category) changes.category = category;
    if (trimmedDescription !== detail.description) changes.description = trimmedDescription;
  }
  const detailsDirty = Object.keys(changes).length > 0;

  const goPending = () => {
    setStatus('pending');
    onUpdated();
  };

  const handleSaveDetails = async () => {
    if (!place || !detail || !detailsDirty || detailsSaving) return;
    setDetailsSaving(true);
    setDetailsError(null);
    setDetailsFieldErrors({});
    setDetailsDone(false);
    try {
      const res = await api.updateMyPlace(place.id, changes);
      setDetail({ ...detail, name: res.name, category: res.category, description: res.description });
      setDetailsDone(true);
      goPending();
    } catch (e) {
      const fe = extractFieldErrors(e);
      if (fe) setDetailsFieldErrors(fe);
      else setDetailsError(extractError(e));
    } finally {
      setDetailsSaving(false);
    }
  };

  const handleRotate = async (photoId: number) => {
    if (busyPhoto !== null) return;
    setBusyPhoto(photoId);
    setPhotoError(null);
    try {
      const res = await api.rotateMyPhoto(photoId);
      // fresh versioned urls cache-bust the img; rotation keeps the approval status
      setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, thumb_url: res.thumb_url, display_url: res.display_url } : p)));
      onUpdated();
    } catch (e) {
      setPhotoError(extractError(e));
    } finally {
      setBusyPhoto(null);
    }
  };

  const handleDeletePhoto = async (photoId: number) => {
    if (busyPhoto !== null) return;
    if (!window.confirm('حذف هذه الصورة؟')) return;
    setBusyPhoto(photoId);
    setPhotoError(null);
    try {
      await api.deleteMyPhoto(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      goPending();
    } catch (e) {
      setPhotoError(extractError(e));
    } finally {
      setBusyPhoto(null);
    }
  };

  const handleAddPhoto = async (file: File | undefined) => {
    if (!place || !file || addingPhoto) return;
    setPhotoError(null);
    if (file.size > MAX_BYTES) {
      setPhotoError(`الصورة ${file.name} تتجاوز 12 ميغابايت`);
      return;
    }
    const dims = await imageDimensions(file);
    if (dims && (dims.width < MIN_DIM || dims.height < MIN_DIM)) {
      setPhotoError(`الصورة ${file.name} أصغر من ${MIN_DIM}x${MIN_DIM} بكسل`);
      return;
    }
    if (dims && (dims.width > MAX_DIM || dims.height > MAX_DIM)) {
      setPhotoError(`الصورة ${file.name} تتجاوز ${MAX_DIM}x${MAX_DIM} بكسل`);
      return;
    }
    setAddingPhoto(true);
    try {
      const res = await api.addMyPhoto(place.id, file);
      setPhotos((prev) => [...prev, { id: res.id, thumb_url: res.thumb_url, display_url: res.display_url, sort: res.sort }]);
      goPending();
    } catch (e) {
      setPhotoError(extractError(e));
    } finally {
      setAddingPhoto(false);
      if (addInputRef.current) addInputRef.current.value = '';
    }
  };

  const handleSaveLocation = async () => {
    if (!place || !point || locationSaving) return;
    setLocationSaving(true);
    setLocationError(null);
    setLocationDone(false);
    try {
      await api.updateMyPlaceLocation(place.id, point);
      setLocationDone(true);
      goPending();
    } catch (e) {
      const err = e as { response?: { data?: { errors?: Record<string, string[]> } } };
      const errors = err.response?.data?.errors;
      setLocationError(errors?.lat?.[0] ?? errors?.lng?.[0] ?? extractError(e));
    } finally {
      setLocationSaving(false);
    }
  };

  const handleDeletePlace = async () => {
    if (!place || deleting) return;
    if (!window.confirm('سيتم حذف المكان وصوره نهائياً، هل أنت متأكد؟')) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteMyPlace(place.id);
      onOpenChange(false);
      onUpdated();
    } catch (e) {
      setDeleteError(extractError(e));
      setDeleting(false);
    }
  };

  if (!place) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle className="flex items-center gap-2">
            إدارة المكان
            <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
          </DialogTitle>
          <DialogDescription>{place.name}</DialogDescription>
        </DialogHeader>

        {loadFailed ? (
          <Alert variant="destructive">
            <AlertDescription>تعذر تحميل بيانات المكان، أعد المحاولة لاحقاً</AlertDescription>
          </Alert>
        ) : !detail ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveDetails();
              }}
            >
              {detailsError && (
                <Alert variant="destructive">
                  <AlertDescription>{detailsError}</AlertDescription>
                </Alert>
              )}
              {detailsDone && (
                <Alert>
                  <AlertDescription>تم الحفظ وستظهر التعديلات بعد موافقة المشرفين</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="manage-place-name">اسم المكان</Label>
                <Input
                  id="manage-place-name"
                  value={name}
                  maxLength={160}
                  onChange={(e) => setName(e.target.value)}
                />
                {detailsFieldErrors.name && <p className="text-xs text-destructive">{detailsFieldErrors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>التصنيف</Label>
                <Select value={category ?? undefined} onValueChange={(v) => setCategory(v as PlaceCategory)}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر التصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detailsFieldErrors.category && (
                  <p className="text-xs text-destructive">{detailsFieldErrors.category}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manage-place-description">الوصف</Label>
                <Textarea
                  id="manage-place-description"
                  value={description}
                  maxLength={1000}
                  rows={4}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="صف المكان وما يميزه (20 حرفاً على الأقل)"
                />
                {detailsFieldErrors.description && (
                  <p className="text-xs text-destructive">{detailsFieldErrors.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  <span dir="ltr">{description.length} / 1000</span>
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={!detailsDirty || detailsSaving}>
                {detailsSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ التعديلات
              </Button>
            </form>

            <div className="space-y-2">
              <Label>الصور</Label>
              <input
                ref={addInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleAddPhoto(e.target.files?.[0])}
              />
              {photoError && (
                <Alert variant="destructive">
                  <AlertDescription>{photoError}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative overflow-hidden rounded-md border border-border">
                    <img src={photo.thumb_url} alt={place.name} loading="lazy" className="h-24 w-full object-cover" />
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
                          onClick={() => handleRotate(photo.id)}
                          className="rounded-md bg-background/80 p-1 text-foreground shadow-sm hover:bg-background"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                        {photos.length > 1 && (
                          <button
                            type="button"
                            aria-label="حذف الصورة"
                            title="حذف الصورة"
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="rounded-md bg-background/80 p-1 text-destructive shadow-sm hover:bg-background"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                ))}
                {photos.length < 10 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-24 flex-col gap-1 text-muted-foreground"
                    disabled={addingPhoto}
                    onClick={() => addInputRef.current?.click()}
                  >
                    {addingPhoto ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                    <span className="text-xs">إضافة صورة</span>
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">الحد الأقصى 10 صور</p>
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveLocation();
              }}
            >
              {locationError && (
                <Alert variant="destructive">
                  <AlertDescription>{locationError}</AlertDescription>
                </Alert>
              )}
              {locationDone && (
                <Alert>
                  <AlertDescription>تم تحديث الموقع وسيظهر التعديل بعد موافقة المشرفين</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="manage-place-coords">الإحداثيات الجديدة</Label>
                <Input
                  id="manage-place-coords"
                  dir="ltr"
                  value={coords}
                  onChange={(e) => setCoords(e.target.value)}
                  placeholder="34.73941, 36.67507"
                />
                {feedback?.kind === 'invalid' && (
                  <p className="text-xs text-destructive">
                    صيغة الإحداثيات غير صحيحة، مثال: 34.73941, 36.67507
                  </p>
                )}
                {feedback?.kind === 'outside' && (
                  <p className="text-xs text-destructive">
                    الإحداثيات خارج حدود سوريا (خط العرض بين 32.0 و 37.5، خط الطول بين 35.5 و 42.5)
                  </p>
                )}
                {point && (
                  <p className="text-xs text-muted-foreground">
                    الإحداثيات:{' '}
                    <span dir="ltr">
                      {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                    </span>
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={!point || locationSaving}>
                {locationSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ الموقع
              </Button>
            </form>

            <div className="space-y-2 border-t border-border pt-4">
              {deleteError && (
                <Alert variant="destructive">
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                disabled={deleting}
                onClick={handleDeletePlace}
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                <Trash2 className="h-4 w-4" />
                حذف المكان
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
