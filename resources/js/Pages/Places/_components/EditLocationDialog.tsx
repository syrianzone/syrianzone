import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { api, extractError } from '../_lib/api';
import type { LatLng, MyPlace } from '../_lib/types';
import { parseLatLng } from './FilterBar';

// client mirror of the server's Syria bounding box
const inSyriaBox = (p: LatLng) => p.lat >= 32.0 && p.lat <= 37.5 && p.lng >= 35.5 && p.lng <= 42.5;

type Feedback =
  | { kind: 'invalid' }
  | { kind: 'outside' }
  | { kind: 'valid'; point: LatLng }
  | null;

export function EditLocationDialog(props: {
  place: MyPlace | null; // null = closed
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void; // caller reloads the mine list
}) {
  const { place, onOpenChange, onUpdated } = props;

  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!place) return;
    setValue(`${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`);
    setFeedback(null);
    setSaving(false);
    setError(null);
    setDone(false);
  }, [place]);

  // debounce validation; feedback null means still typing, save stays disabled
  useEffect(() => {
    setFeedback(null);
    const timer = window.setTimeout(() => {
      const parsed = parseLatLng(value.trim());
      if (!parsed) setFeedback({ kind: 'invalid' });
      else if (!inSyriaBox(parsed)) setFeedback({ kind: 'outside' });
      else setFeedback({ kind: 'valid', point: parsed });
    }, 250);
    return () => window.clearTimeout(timer);
    // place is a dep so reopening with an identical prefill string still revalidates
  }, [value, place]);

  const point = feedback?.kind === 'valid' ? feedback.point : null;

  const handleSave = async () => {
    if (!place || !point || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateMyPlaceLocation(place.id, point);
      setDone(true);
      onUpdated();
    } catch (e) {
      const err = e as { response?: { data?: { errors?: Record<string, string[]> } } };
      const errors = err.response?.data?.errors;
      setError(errors?.lat?.[0] ?? errors?.lng?.[0] ?? extractError(e));
    } finally {
      setSaving(false);
    }
  };

  if (!place) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>تعديل موقع المكان</DialogTitle>
          <DialogDescription>{place.name}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>تم تحديث الموقع وسيظهر التعديل بعد موافقة المشرفين</AlertDescription>
            </Alert>
            <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
              إغلاق
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="edit-location-coords">الإحداثيات الجديدة</Label>
              <Input
                id="edit-location-coords"
                dir="ltr"
                value={value}
                onChange={(e) => setValue(e.target.value)}
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
            <Button type="submit" className="w-full" disabled={!point || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ الموقع
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
