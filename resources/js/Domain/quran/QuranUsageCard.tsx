import { HardDrive } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { confirmDialog } from '@/Lib/confirm';
import { formatBytes } from '@/Domain/quran/radioUsage';
import { clearAllUsage, useUsageStore } from '@/Domain/quran/usageStore';
import { formatDuration } from '@/Lib/format';

/** Listening data-usage readout, shared by the radio tab and the reader. */
export default function QuranUsageCard() {
  const perHour = useUsageStore((s) => s.perHour);
  const session = useUsageStore((s) => s.session);
  const device = useUsageStore((s) => s.device);
  const account = useUsageStore((s) => s.account);
  const isLoggedIn = useUsageStore((s) => s.isLoggedIn);

  const clearUsage = async () => {
    const confirmed = await confirmDialog({
      title: 'مسح سجل استهلاك البيانات؟',
      description: isLoggedIn
        ? 'سيُمسح سجل هذا الجهاز وهذا الحساب نهائياً ولا يمكن التراجع.'
        : 'سيُمسح سجل هذا الجهاز نهائياً ولا يمكن التراجع.',
      confirmText: 'مسح',
      destructive: true,
    });
    if (!confirmed) return;
    await clearAllUsage();
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <HardDrive className="h-4 w-4 text-primary" />
            استهلاك البيانات
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void clearUsage()}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            مسح السجل
          </Button>
        </div>

        <dl className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">الاستهلاك المتوقع</dt>
            <dd className="whitespace-nowrap font-medium">{formatBytes(perHour)} / ساعة</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">هذه الجلسة</dt>
            <dd className="whitespace-nowrap font-mono tabular-nums">
              {formatBytes(session.bytes)}
              <span className="mx-1.5 text-muted-foreground/60">·</span>
              {formatDuration(session.seconds * 1000)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">هذا الجهاز</dt>
            <dd className="whitespace-nowrap font-mono tabular-nums">
              {formatBytes(device.bytes)}
              <span className="mx-1.5 text-muted-foreground/60">·</span>
              {formatDuration(device.seconds * 1000)}
            </dd>
          </div>
          {account && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">حسابك (كل الأجهزة)</dt>
              <dd className="whitespace-nowrap font-mono tabular-nums">
                {formatBytes(account.bytes)}
                <span className="mx-1.5 text-muted-foreground/60">·</span>
                {formatDuration(account.seconds * 1000)}
              </dd>
            </div>
          )}
        </dl>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          محسوب من معدّل التلاوة — القياس الفعلي غير متاح من المتصفح.
          {isLoggedIn ? ' حسابك محفوظ على الخادم.' : ' السجل محفوظ على هذا الجهاز فقط لأنك غير مسجّل.'}
        </p>
      </CardContent>
    </Card>
  );
}
