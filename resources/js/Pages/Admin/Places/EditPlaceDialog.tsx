import { useEffect, useState } from 'react';
import { inSyriaBox } from '@/Domain/geography/syria';
import { Loader2 } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/Components/ui/dialog';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/Components/ui/select';
import { Textarea } from '@/Components/ui/textarea';
import { api } from '@/Domain/places/api';
import { apiErrorMessage, apiFieldErrors } from '@/Lib/api';
import FieldError, { fieldA11y } from '@/Components/ui/field-error';
import { CATEGORIES } from '@/Domain/places/categories';
import type { AdminPlace, PlaceCategory } from '@/Domain/places/types';

export function EditPlaceDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  place: AdminPlace;
  onSaved: () => void;
}) {
  const { open, onOpenChange, place, onSaved } = props;
  const [name, setName] = useState(place.name);
  const [category, setCategory] = useState<PlaceCategory>(place.category);
  const [description, setDescription] = useState(place.description);
  const [lat, setLat] = useState(String(place.lat));
  const [lng, setLng] = useState(String(place.lng));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setName(place.name);
    setCategory(place.category);
    setDescription(place.description);
    setLat(String(place.lat));
    setLng(String(place.lng));
    setError(null);
    setFieldErrors({});
  }, [open, place]);

  // unsaved edits: block accidental dismissal (overlay click, Escape); the
  // explicit إلغاء and X buttons still close
  const dirty =
    name !== place.name ||
    category !== place.category ||
    description !== place.description ||
    lat !== String(place.lat) ||
    lng !== String(place.lng);

  async function save() {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum) || !inSyriaBox({ lat: latNum, lng: lngNum })) {
      setError('الإحداثيات خارج حدود سوريا');
      return;
    }
    const changed: Partial<Pick<AdminPlace, 'name' | 'category' | 'description' | 'lat' | 'lng'>> = {};
    if (name !== place.name) changed.name = name;
    if (category !== place.category) changed.category = category;
    if (description !== place.description) changed.description = description;
    if (latNum !== place.lat) changed.lat = latNum;
    if (lngNum !== place.lng) changed.lng = lngNum;
    if (Object.keys(changed).length === 0) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.adminUpdatePlace(place.id, changed);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      // A 422 body carries { message, errors: { name: [...], lat: [...] } }.
      // Only Arabic messages may reach the form; when Laravel's English
      // defaults are all there is, mark the field names the 422 sent with a
      // neutral Arabic note instead.
      const arabic = apiFieldErrors(e, { arabicOnly: true });
      if (Object.keys(arabic).length) {
        setFieldErrors(arabic);
      } else {
        const fields = Object.keys(apiFieldErrors(e));
        if (fields.length > 0) {
          setFieldErrors(Object.fromEntries(fields.map((field) => [field, 'تحقق من هذه القيمة'])));
        } else {
          setError(apiErrorMessage(e));
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        onInteractOutside={(e) => {
          if (dirty || busy) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (dirty || busy) e.preventDefault();
        }}
      >
        <DialogHeader className="text-right">
          <DialogTitle>تعديل المكان</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`edit-name-${place.id}`}>الاسم</Label>
            <Input
              id={`edit-name-${place.id}`}
              value={name}
              maxLength={160}
              onChange={(e) => setName(e.target.value)}
              {...fieldA11y(`edit-name-${place.id}-error`, fieldErrors.name)}
            />
            <FieldError id={`edit-name-${place.id}-error`} message={fieldErrors.name} />
          </div>

          <div className="space-y-1.5">
            <Label>التصنيف</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as PlaceCategory)}>
              <SelectTrigger
                aria-label="التصنيف"
                {...fieldA11y(`edit-category-${place.id}-error`, fieldErrors.category)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id={`edit-category-${place.id}-error`} message={fieldErrors.category} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`edit-desc-${place.id}`}>الوصف</Label>
            <Textarea
              id={`edit-desc-${place.id}`}
              value={description}
              rows={4}
              maxLength={1000}
              onChange={(e) => setDescription(e.target.value)}
              {...fieldA11y(`edit-desc-${place.id}-error`, fieldErrors.description)}
            />
            <FieldError id={`edit-desc-${place.id}-error`} message={fieldErrors.description} />
            <p className="text-xs text-muted-foreground">
              <span dir="ltr">{description.length} / 1000</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-lat-${place.id}`}>خط العرض</Label>
              <Input
                id={`edit-lat-${place.id}`}
                type="number"
                dir="ltr"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                {...fieldA11y(`edit-lat-${place.id}-error`, fieldErrors.lat)}
              />
              <FieldError id={`edit-lat-${place.id}-error`} message={fieldErrors.lat} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit-lng-${place.id}`}>خط الطول</Label>
              <Input
                id={`edit-lng-${place.id}`}
                type="number"
                dir="ltr"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                {...fieldA11y(`edit-lng-${place.id}-error`, fieldErrors.lng)}
              />
              <FieldError id={`edit-lng-${place.id}-error`} message={fieldErrors.lng} />
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="button" disabled={busy} onClick={save}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ الحفظ
              </>
            ) : (
              'حفظ'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
