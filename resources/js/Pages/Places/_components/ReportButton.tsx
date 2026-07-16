import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { useAuth } from '@/Contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, extractError } from '../_lib/api';

const REASONS = [
  { key: 'spam', label: 'مزعج' },
  { key: 'wrong_info', label: 'معلومات خاطئة' },
  { key: 'inappropriate', label: 'غير لائق' },
  { key: 'duplicate', label: 'مكرر' },
  { key: 'other', label: 'أخرى' },
];

export function ReportButton(props: { placeId: number }) {
  const { placeId } = props;
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setReason(null);
      setDetails('');
      setError(null);
      setMessage(null);
      setSubmitting(false);
    }
    setOpen(next);
  };

  const submit = async () => {
    if (!reason || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.report(placeId, reason, details.trim() || undefined);
      setMessage(res.message);
    } catch (e) {
      setError(extractError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(true)}>
        <Flag className="h-4 w-4" />
        إبلاغ
      </Button>
      <DialogContent dir="rtl" className="text-right">
        <DialogHeader className="text-right">
          <DialogTitle>الإبلاغ عن مكان</DialogTitle>
        </DialogHeader>
        {!user ? (
          <a href="/auth/google" className="text-sm text-primary underline underline-offset-4">
            تسجيل الدخول عبر جوجل
          </a>
        ) : message ? (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
            <Button type="button" className="w-full" onClick={() => setOpen(false)}>
              إغلاق
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label>سبب البلاغ</Label>
              <Select value={reason ?? undefined} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر السبب" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-details">تفاصيل (اختياري)</Label>
              <Textarea
                id="report-details"
                value={details}
                maxLength={1000}
                rows={3}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>
            <Button type="button" className="w-full" disabled={!reason || submitting} onClick={submit}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              إرسال البلاغ
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
