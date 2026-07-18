import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/Contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, extractError, extractFieldErrors } from '../_lib/api';
import { CATEGORIES } from '../_lib/categories';
import type { LatLng, NearbyPlace, PlaceCategory } from '../_lib/types';
import { DuplicateSuggestions } from './DuplicateSuggestions';
import { PhotoPicker } from './PhotoPicker';

type Step = 'auth' | 'duplicates' | 'form' | 'done';

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

export function SubmitSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: LatLng | null;
  onSubmitted: (id: number) => void;
  onSelectExisting: (id: number) => void;
}) {
  const { open, onOpenChange, point, onSubmitted, onSelectExisting } = props;
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [step, setStep] = useState<Step>('auth');
  const [nearby, setNearby] = useState<NearbyPlace[] | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !point) return;
    setName('');
    setCategory(null);
    setDescription('');
    setPhotos([]);
    setError(null);
    setFieldErrors({});
    setSubmitting(false);
    setSubmittedId(null);
    setNearby(null);
    if (!user) {
      setStep('auth');
      return;
    }
    setStep('duplicates');
    let cancelled = false;
    api.nearby({ lat: point.lat, lng: point.lng, radius_km: 0.25, include_pending: true })
      .then((res) => {
        if (cancelled) return;
        if (res.places.length > 0) setNearby(res.places);
        else setStep('form');
      })
      // the duplicate check is a convenience, never block submission on it
      .catch(() => {
        if (!cancelled) setStep('form');
      });
    return () => {
      cancelled = true;
    };
  }, [open, point, user]);

  const dirty =
    name.trim() !== '' || category !== null || description.trim() !== '' || photos.length > 0;

  const handleOpenChange = (next: boolean) => {
    // a stray overlay tap or Escape would silently wipe the draft, ask first
    if (!next && step === 'form' && dirty && !submitting) {
      if (!window.confirm('سيتم تجاهل ما أدخلته، هل تريد الإغلاق؟')) return;
    }
    if (!next && step === 'done' && submittedId !== null) onSubmitted(submittedId);
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!point || submitting) return;
    setError(null);
    setFieldErrors({});
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    if (!trimmedName || trimmedName.length > 160) {
      setError('أدخل اسم المكان (160 حرفاً كحد أقصى)');
      return;
    }
    if (!category) {
      setError('اختر التصنيف');
      return;
    }
    if (trimmedDesc.length < 20 || trimmedDesc.length > 1000) {
      setError('الوصف يجب أن يكون بين 20 و 1000 حرف');
      return;
    }
    if (photos.length < 1 || photos.length > 10) {
      setError('أضف من صورة واحدة إلى 10 صور');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.submitPlace({
        name: trimmedName,
        category,
        description: trimmedDesc,
        lat: point.lat,
        lng: point.lng,
        photos,
      });
      setSubmittedId(res.id);
      setStep('done');
    } catch (e) {
      const fe = extractFieldErrors(e);
      if (fe) {
        setFieldErrors(fe);
        setError(null);
      } else {
        setFieldErrors({});
        setError(extractError(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!point) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'left'}
        dir="rtl"
        className={isMobile ? 'max-h-[85dvh] overflow-y-auto' : 'overflow-y-auto'}
      >
        <SheetHeader className="text-right">
          <SheetTitle>إضافة مكان جديد</SheetTitle>
          <SheetDescription>
            شارك مكاناً يستحق المشوار ليظهر على الخريطة بعد موافقة المشرفين
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {step === 'auth' && (
            <div className="space-y-3 text-sm">
              <p>سجل الدخول لتتمكن من إضافة الأماكن</p>
              <a href="/auth/google" className="inline-block text-primary underline underline-offset-4">
                تسجيل الدخول عبر جوجل
              </a>
            </div>
          )}

          {step === 'duplicates' && nearby === null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ التحقق من الأماكن القريبة
            </div>
          )}

          {step === 'duplicates' && nearby !== null && (
            <DuplicateSuggestions
              places={nearby}
              onSelectExisting={(id) => {
                onSelectExisting(id);
                onOpenChange(false);
              }}
              onContinue={() => setStep('form')}
            />
          )}

          {step === 'form' && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="place-name">اسم المكان</Label>
                <Input
                  id="place-name"
                  value={name}
                  maxLength={160}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: مقهى النوفرة"
                />
                {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
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
                {fieldErrors.category && <p className="text-xs text-destructive">{fieldErrors.category}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="place-description">الوصف</Label>
                <Textarea
                  id="place-description"
                  value={description}
                  maxLength={1000}
                  rows={4}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="صف المكان وما يميزه (20 حرفاً على الأقل)"
                />
                {fieldErrors.description && (
                  <p className="text-xs text-destructive">{fieldErrors.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  <span dir="ltr">{description.length} / 1000</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>الإحداثيات</Label>
                <p className="text-sm text-muted-foreground">
                  <span dir="ltr">
                    {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                  </span>
                </p>
                {fieldErrors.lat && <p className="text-xs text-destructive">{fieldErrors.lat}</p>}
                {fieldErrors.lng && <p className="text-xs text-destructive">{fieldErrors.lng}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>الصور</Label>
                <PhotoPicker files={photos} onChange={setPhotos} />
                {fieldErrors.photos && <p className="text-xs text-destructive">{fieldErrors.photos}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                إرسال المكان
              </Button>
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-3">
              <Alert>
                <AlertDescription>تم إرسال المكان وسيظهر على الخريطة بعد الموافقة</AlertDescription>
              </Alert>
              <Button type="button" className="w-full" onClick={() => handleOpenChange(false)}>
                إغلاق
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
