import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { api, extractError } from '../../Places/_lib/api';
import type { Paginated, PlaceReport } from '../../Places/_lib/types';

const REASON_LABELS: Record<string, string> = {
  spam: 'مزعج',
  wrong_info: 'معلومات خاطئة',
  inappropriate: 'غير لائق',
  duplicate: 'مكرر',
  other: 'أخرى',
};

export function ReportsTab() {
  const [reports, setReports] = useState<Paginated<PlaceReport> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  const fetchReports = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminListReports('open', p);
      // resolving the last report of the last page leaves p out of range: clamp back
      if (res.data.length === 0 && res.current_page > res.last_page) {
        setPage(res.last_page);
        return;
      }
      setReports(res);
    } catch (e) {
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(page);
  }, [page, fetchReports]);

  const handleResolve = async (id: number, action: 'resolve' | 'dismiss') => {
    setActingId(id);
    setError(null);
    try {
      await api.adminResolveReport(id, action);
      await fetchReports(page);
    } catch (e) {
      setError(extractError(e));
    } finally {
      setActingId(null);
    }
  };

  const handleDeletePlace = async (report: PlaceReport) => {
    if (!confirm(`حذف المكان "${report.place.name}" نهائياً مع جميع بياناته؟`)) return;
    setActingId(report.id);
    setError(null);
    try {
      await api.adminDeletePlace(report.place.id);
      await fetchReports(page);
    } catch (e) {
      setError(extractError(e));
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {reports && (
        <p className="text-sm text-muted-foreground">
          البلاغات المفتوحة: <span dir="ltr">{reports.total}</span>
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          جارٍ التحميل
        </div>
      ) : !reports || reports.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بلاغات مفتوحة</p>
      ) : (
        <div className="space-y-3">
          {reports.data.map((report) => (
            <Card key={report.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="destructive">{REASON_LABELS[report.reason] ?? report.reason}</Badge>
                  <span className="text-sm font-bold">{report.place.name}</span>
                </div>
                {report.details && <p className="text-sm text-muted-foreground">{report.details}</p>}
                <p className="text-xs text-muted-foreground">
                  المبلّغ: {report.user.name} ({new Date(report.created_at).toLocaleDateString('ar-SY')})
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={actingId === report.id}
                    onClick={() => handleResolve(report.id, 'resolve')}
                  >
                    تم الحل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actingId === report.id}
                    onClick={() => handleResolve(report.id, 'dismiss')}
                  >
                    تجاهل
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={actingId === report.id}
                    onClick={() => handleDeletePlace(report)}
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف المكان
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
