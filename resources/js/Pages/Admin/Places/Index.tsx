import { useCallback, useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/Domain/places/api';
import { apiErrorMessage } from '@/Lib/api';
import type { AdminPlace, Paginated } from '@/Domain/places/types';
import { notify } from '@/Lib/notify';
import { confirmDialog } from '@/Lib/confirm';
import { PlaceReviewCard } from './PlaceReviewCard';
import { RejectDialog } from './RejectDialog';
import { ReportsTab } from './ReportsTab';
import { useTabList } from '@/Lib/useTabList';
import { cn } from '@/Lib/utils';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const TABS = ['places', 'reports'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = { places: 'الأماكن', reports: 'البلاغات' };

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'approved', label: 'مقبول' },
  { value: 'rejected', label: 'مرفوض' },
  { value: 'all', label: 'الكل' },
];

export default function Index() {
  const [tab, setTab] = useState<Tab>('places');
  const tabs = useTabList({ ids: TABS, active: tab, onChange: setTab });
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [page, setPage] = useState(1);
  const [places, setPlaces] = useState<Paginated<AdminPlace> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);

  const fetchPlaces = useCallback(async (s: StatusFilter, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminListPlaces(s, p);
      // moderating the last item of the last page leaves p out of range: clamp back
      if (res.data.length === 0 && res.current_page > res.last_page) {
        setPage(res.last_page);
        return;
      }
      setPlaces(res);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch when returning to the places tab: resolving a report there can
  // move a place between statuses.
  useEffect(() => {
    if (tab === 'places') fetchPlaces(status, page);
  }, [tab, status, page, fetchPlaces]);

  const refetch = () => fetchPlaces(status, page);

  const handleApprove = async (id: number) => {
    setError(null);
    try {
      await api.adminApprove(id);
      await refetch();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const handleRejectConfirm = async (reason: string | null) => {
    if (rejectId === null) return;
    setError(null);
    try {
      await api.adminReject(rejectId, reason);
      setRejectId(null);
      await refetch();
    } catch (e) {
      setRejectId(null);
      setError(apiErrorMessage(e));
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog({ title: 'حذف المكان نهائياً؟', description: 'سيتم حذف المكان مع جميع بياناته.', destructive: true, confirmText: 'حذف' }))) return;
    setError(null);
    try {
      await api.adminDeletePlace(id);
      await refetch();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <MainLayout>
      
      <div dir="rtl" className="container mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 text-xl font-bold">إدارة أماكن مشوار</h1>

        <div {...tabs.tabListProps} aria-label="أقسام الإدارة" className="mb-4 flex gap-1 border-b border-border">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              {...tabs.tabProps(id)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                tab === id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </div>

        {tab === 'reports' ? (
          <div {...tabs.panelProps('reports')}>
            <ReportsTab />
          </div>
        ) : (
          <div {...tabs.panelProps('places')} className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as StatusFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40" aria-label="حالة المكان">
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
              {places && (
                <p className="text-sm text-muted-foreground">
                  النتائج: <span dir="ltr">{places.total}</span>
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
            ) : !places || places.data.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">لا توجد أماكن</p>
            ) : (
              <div className="space-y-3">
                {places.data.map((place) => (
                  <PlaceReviewCard
                    key={place.id}
                    place={place}
                    onApprove={handleApprove}
                    onReject={setRejectId}
                    onDelete={handleDelete}
                    onChanged={refetch}
                  />
                ))}
              </div>
            )}

            {places && places.last_page > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
                  السابق
                </Button>
                <span className="text-sm text-muted-foreground" dir="ltr">
                  {places.current_page} / {places.last_page}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= places.last_page || loading}
                  onClick={() => setPage(page + 1)}
                >
                  التالي
                </Button>
              </div>
            )}
          </div>
        )}

        <RejectDialog
          open={rejectId !== null}
          onOpenChange={(open) => {
            if (!open) setRejectId(null);
          }}
          onConfirm={handleRejectConfirm}
        />
      </div>
    </MainLayout>
  );
}
