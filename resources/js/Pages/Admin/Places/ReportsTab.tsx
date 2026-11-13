import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { confirmDialog } from '@/Lib/confirm';
import { notify } from '@/Lib/notify';
import { api } from '@/Domain/places/api';
import { apiErrorMessage } from '@/Lib/api';
import { REPORT_REASON_LABELS } from '@/Domain/places/reports';
import type { AdminPlaceReport, Paginated, PlaceReportStatus } from '@/Domain/places/types';

type StatusFilter = PlaceReportStatus | 'all';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'مفتوحة' },
  { value: 'resolved', label: 'تمت معالجتها' },
  { value: 'dismissed', label: 'مرفوضة' },
  { value: 'all', label: 'الكل' },
];

const STATUS_LABELS: Record<PlaceReportStatus, string> = {
  open: 'مفتوح',
  resolved: 'تمت معالجته',
  dismissed: 'مرفوض',
};

const PLACE_STATUS_LABELS: Record<AdminPlaceReport['place']['status'], string> = {
  approved: 'منشور',
  pending: 'قيد المراجعة',
  rejected: 'مرفوض',
};

export function ReportsTab() {
  const [status, setStatus] = useState<StatusFilter>('open');
  const [page, setPage] = useState(1);
  const [reports, setReports] = useState<Paginated<AdminPlaceReport> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchReports = useCallback(async (s: StatusFilter, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminListReports(s, p);
      if (res.data.length === 0 && res.current_page > res.last_page && res.last_page > 0) {
        setPage(res.last_page);
        return;
      }
      setReports(res);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(status, page);
  }, [status, page, fetchReports]);

  const resolve = async (report: AdminPlaceReport, action: 'dismiss' | 'unpublish') => {
    // A place that is no longer published only needs its reports closed.
    const published = report.place.status === 'approved';
    if (action === 'unpublish' && published) {
      const ok = await confirmDialog({
        title: 'إخفاء المكان؟',
        description: `سيُزال «${report.place.name}» من الخريطة ويعود إلى قائمة المراجعة، وتُغلق كل البلاغات المفتوحة عليه.`,
        destructive: true,
        confirmText: 'إخفاء',
      });
      if (!ok) return;
    }
    setBusyId(report.id);
    try {
      await api.adminResolveReport(report.id, action);
      notify.success(action === 'dismiss' ? 'تم رفض البلاغ' : published ? 'تم إخفاء المكان' : 'تم إغلاق البلاغ');
      await fetchReports(status, page);
    } catch (e) {
      notify.error(apiErrorMessage(e));
      // e.g. 409 when another moderator already handled it: show the current state
      await fetchReports(status, page);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as StatusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="حالة البلاغ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {reports && (
          <p className="text-sm text-muted-foreground">
            النتائج: <span dir="ltr">{reports.total}</span>
          </p>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          جارٍ التحميل
        </div>
      ) : !reports || reports.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بلاغات</p>
      ) : (
        <ul className="space-y-3">
          {reports.data.map((report) => (
            <li key={report.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/mishwar?place=${report.place.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {report.place.name}
                </a>
                <Badge variant="secondary">{PLACE_STATUS_LABELS[report.place.status]}</Badge>
                <Badge variant={report.status === 'open' ? 'destructive' : 'outline'}>
                  {STATUS_LABELS[report.status]}
                </Badge>
              </div>
              <p className="text-sm text-foreground">
                <span className="font-medium">السبب:</span> {REPORT_REASON_LABELS[report.reason]}
              </p>
              {report.details && (
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{report.details}</p>
              )}
              <p className="text-xs text-muted-foreground">
                أبلغ عنه {report.user.name} ·{' '}
                <time dateTime={report.created_at}>
                  {new Date(report.created_at).toLocaleDateString('ar-SY')}
                </time>
              </p>
              {report.status === 'open' && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busyId === report.id}
                    onClick={() => resolve(report, 'unpublish')}
                  >
                    {report.place.status === 'approved' ? 'إخفاء المكان' : 'إغلاق البلاغ'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === report.id}
                    onClick={() => resolve(report, 'dismiss')}
                  >
                    رفض البلاغ
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {reports && reports.last_page > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            السابق
          </Button>
          <span className="text-sm text-muted-foreground" dir="ltr">
            {reports.current_page} / {reports.last_page}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= reports.last_page || loading}
            onClick={() => setPage(page + 1)}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  );
}
