import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export function RejectDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string | null) => void;
}) {
  const { open, onOpenChange, onConfirm } = props;
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>رفض المكان</DialogTitle>
          <DialogDescription>سبب الرفض يظهر للمساهم ليتمكن من التحسين</DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          rows={6}
          maxLength={1000}
          autoFocus
          className="min-h-36"
          placeholder="اكتب سبباً واضحاً يساعد المساهم على التحسين، مثال: الصور غير واضحة، أو الوصف لا يذكر ما يميز المكان"
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="button" variant="destructive" onClick={() => onConfirm(reason.trim() || null)}>
            تأكيد الرفض
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
