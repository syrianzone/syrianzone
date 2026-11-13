import { useEffect, useRef, useState } from 'react';
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
import { api } from '@/Domain/places/api';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import { CATEGORIES } from '@/Domain/places/categories';
import type { LatLng, NearbyPlace, PlaceCategory } from '@/Domain/places/types';
import { confirmDialog } from '@/Lib/confirm';
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
  onSubmitted: () => void;
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
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Bumped only when a submit fails, so the focus effect runs after the errors
  // are in the DOM — never on an ordinary re-render or while the user types.
  const [failedSubmit, setFailedSubmit] = useState(0);

  useEffect(() => {
    if (!open || !point) return;
    setName('');
    setCategory(null);
    setDescription('');
    setPhotos([]);
    setError(null);
    setFieldErrors({});
    setSubmitting(false);
    setSubmitted(false);
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

  // After a failed submit, land on the first control marked invalid instead of
  // leaving focus on the submit button.
  useEffect(() => {
    if (!failedSubmit) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [failedSubmit]);

  const dirty =
    name.trim() !== '' || category !== null || description.trim() !== '' || photos.length > 0;

  const handleOpenChange = async (next: boolean) => {
    // a stray overlay tap or Escape would silently wipe the draft, ask first
    if (!next && step === 'form' && dirty && !submitting) {
      const ok = await confirmDialog({ title: 'إغلاق دون إرسال؟', description: 'سيتم تجاهل ما أدخلته.', destructive: true, confirmText: 'تجاهل وإغلاق', cancelText: 'متابعة' });
      if (!ok) return;
    }
    if (!next && step === 'done' && submitted) onSubmitted();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!point || submitting) return;
    setError(null);
    setFieldErrors({});
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    // a client-side failure belongs to its field: mark it invalid, show the
    // message under it, and let the effect above move focus there
    const fail = (field: string, message: string) => {
      setFieldErrors({ [field]: message });
      setFailedSubmit((n) => n + 1);
    };
    if (!trimmedName || trimmedName.length > 160) {
      fail('name', 'أدخل اسم المكان (160 حرفاً كحد أقصى)');
      return;
    }
    if (!category) {
      fail('category', 'اختر التصنيف');
      return;
    }
    if (trimmedDesc.length < 20 || trimmedDesc.length > 1000) {
      fail('description', 'الوصف يجب أن يكون بين 20 و 1000 حرف');
      return;
    }
    if (photos.length < 1 || photos.length > 10) {
      fail('photos', 'أضف من صورة واحدة إلى 10 صور');
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
      setSubmitted(true);
      setStep('done');
    } catch (e) {
      const fe = apiFieldErrors(e, { arabicOnly: true });
      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        setError(null);
      } else {
        setFieldErrors({});
        setError(apiErrorMessage(e));
      }
      setFailedSubmit((n) => n + 1);
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
              ref={formRef}
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
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? 'place-name-error' : undefined}
                />
                {fieldErrors.name && (
                  <p id="place-name-error" role="alert" className="text-xs text-destructive">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>التصنيف</Label>
                <Select value={category ?? undefined} onValueChange={(v) => setCategory(v as PlaceCategory)}>
                  <SelectTrigger
                    aria-invalid={!!fieldErrors.category}
                    aria-describedby={fieldErrors.category ? 'place-category-error' : undefined}
                   aria-label="اختر التصنيف">
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
                {fieldErrors.category && (
                  <p id="place-category-error" role="alert" className="text-xs text-destructive">
                    {fieldErrors.category}
                  </p>
                )}
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
                  aria-invalid={!!fieldErrors.description}
                  aria-describedby={fieldErrors.description ? 'place-description-error' : undefined}
                />
                {fieldErrors.description && (
                  <p id="place-description-error" role="alert" className="text-xs text-destructive">
                    {fieldErrors.description}
                  </p>
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
                {fieldErrors.lat && <p role="alert" className="text-xs text-destructive">{fieldErrors.lat}</p>}
                {fieldErrors.lng && <p role="alert" className="text-xs text-destructive">{fieldErrors.lng}</p>}
              </div>
              <div
                className="space-y-1.5"
                role="group"
                aria-label="الصور"
                tabIndex={-1}
                aria-invalid={!!fieldErrors.photos}
                aria-describedby={fieldErrors.photos ? 'place-photos-error' : undefined}
              >
                <Label>الصور</Label>
                <PhotoPicker files={photos} onChange={setPhotos} />
                {fieldErrors.photos && (
                  <p id="place-photos-error" role="alert" className="text-xs text-destructive">
                    {fieldErrors.photos}
                  </p>
                )}
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
