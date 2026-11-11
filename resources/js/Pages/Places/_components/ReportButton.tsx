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
  DialogDescription,
  DialogFooter,
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
import { notify } from '@/Lib/notify';
import { api, extractError } from '../_lib/api';
import { REPORT_REASONS } from '../_lib/reports';
import type { PlaceReportReason } from '../_lib/types';

export function ReportButton(props: { placeId: number }) {
  const { placeId } = props;
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<PlaceReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setReason(null);
      setDetails('');
      setError(null);
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
      setOpen(false);
      notify.success(res.message);
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
      <DialogContent dir="rtl" className="text-start">
        <DialogHeader className="text-start">
          <DialogTitle>الإبلاغ عن مكان</DialogTitle>
          <DialogDescription>يراجع فريق الإشراف البلاغ ويخفي المكان إن خالف الشروط.</DialogDescription>
        </DialogHeader>
        {!user ? (
          <a href="/auth/google" className="text-sm text-primary underline underline-offset-4">
            سجّل الدخول عبر جوجل للإبلاغ
          </a>
        ) : (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="report-reason">سبب البلاغ</Label>
              <Select value={reason ?? undefined} onValueChange={(v) => setReason(v as PlaceReportReason)}>
                <SelectTrigger id="report-reason">
                  <SelectValue placeholder="اختر السبب" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
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
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
              <Button type="button" disabled={!reason || submitting} onClick={submit}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                إرسال البلاغ
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
