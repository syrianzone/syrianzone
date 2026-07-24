import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { useAuth } from '@/Contexts/AuthContext';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/Lib/utils';
import { api, extractError } from '../_lib/api';
import type { MyPlace, Paginated, PlaceListItem, PlaceStatus } from '../_lib/types';
import { GuidesTab } from './GuidesTab';
import { ManagePlaceDialog } from './ManagePlaceDialog';
import { PlaceCard } from './PlaceCard';
import { PlaceDetailView } from './PlaceDetailView';

const STATUS_LABELS: Record<PlaceStatus, string> = {
  pending: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
};

const STATUS_VARIANTS: Record<PlaceStatus, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

// mount-only fetch: tab contents remount on each tab switch, which refreshes the data
function usePagedList<T>(fetchPage: (page: number) => Promise<Paginated<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const reload = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetchPage(1);
      setItems(res.data);
      setPage(res.current_page);
      setLastPage(res.last_page);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetchPage(page + 1);
      setItems((prev) => [...prev, ...res.data]);
      setPage(res.current_page);
      setLastPage(res.last_page);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return { items, loading, failed, reload, hasMore: page < lastPage, loadMore };
}

function ListShell(props: {
  loading: boolean;
  empty: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  failed?: boolean;
  onRetry?: () => void;
  children: ReactNode;
}) {
  const { loading, empty, hasMore, onLoadMore, failed = false, onRetry, children } = props;
  return (
    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
      {children}
      {!loading && failed && (
        <div className="space-y-2 py-4 text-center">
          <p className="text-sm text-destructive">تعذر تحميل القائمة</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              إعادة المحاولة
            </Button>
          )}
        </div>
      )}
      {!loading && !failed && empty && (
        <p className="py-8 text-center text-sm text-muted-foreground">لا توجد أماكن</p>
      )}
      {loading && (
        <div className="flex justify-center py-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {hasMore && !loading && (
        <Button type="button" variant="outline" className="w-full" onClick={onLoadMore}>
          عرض المزيد
        </Button>
      )}
    </div>
  );
}

function SavesTab(props: { onSelect: (id: number) => void }) {
  const { items, loading, failed, reload, hasMore, loadMore } = usePagedList<PlaceListItem>((page) => api.mySaves(page));
  return (
    <ListShell loading={loading} empty={items.length === 0} hasMore={hasMore} onLoadMore={loadMore} failed={failed} onRetry={reload}>
      {items.map((p) => (
        <PlaceCard key={p.id} place={p} onClick={props.onSelect} />
      ))}
    </ListShell>
  );
}

function MineTab(props: { onSelect: (id: number) => void }) {
  const { items, loading, failed, reload, hasMore, loadMore } = usePagedList<MyPlace>((page) => api.myPlaces(page));
  const [managing, setManaging] = useState<MyPlace | null>(null);
  const [resubmitting, setResubmitting] = useState<number | null>(null);
  const [resubmitted, setResubmitted] = useState<Set<number>>(new Set());
  const [resubmitErrors, setResubmitErrors] = useState<Record<number, string>>({});

  const resubmit = async (id: number) => {
    if (resubmitting !== null) return;
    setResubmitting(id);
    setResubmitErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      await api.resubmitMyPlace(id);
      setResubmitted((prev) => new Set(prev).add(id));
      reload();
    } catch (e) {
      setResubmitErrors((prev) => ({ ...prev, [id]: extractError(e) }));
    } finally {
      setResubmitting(null);
    }
  };

  return (
    <>
      <ListShell loading={loading} empty={items.length === 0} hasMore={hasMore} onLoadMore={loadMore} failed={failed} onRetry={reload}>
        {items.map((p) => (
          <div key={p.id} className="space-y-1">
            <PlaceCard place={p} onClick={props.onSelect} />
            <div className="flex items-start gap-2 px-1">
              <Badge variant={STATUS_VARIANTS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
              <Button type="button" variant="ghost" size="sm" className="ms-auto" onClick={() => setManaging(p)}>
                <Pencil className="h-4 w-4" />
                إدارة
              </Button>
            </div>
            {p.status === 'rejected' && p.rejection_reason && (
              <div className="flex items-start gap-2 px-1">
                <p className="flex-1 text-xs text-muted-foreground">{p.rejection_reason}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resubmitting === p.id}
                  onClick={() => resubmit(p.id)}
                >
                  {resubmitting === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  إعادة إرسال
                </Button>
              </div>
            )}
            {resubmitErrors[p.id] && (
              <p className="px-1 text-xs text-destructive">{resubmitErrors[p.id]}</p>
            )}
            {resubmitted.has(p.id) && (
              <p className="px-1 text-xs text-muted-foreground">تمت إعادة الإرسال وستتم مراجعتها من المشرفين</p>
            )}
          </div>
        ))}
      </ListShell>
      <ManagePlaceDialog place={managing} onOpenChange={(o) => !o && setManaging(null)} onUpdated={reload} />
    </>
  );
}

export function PlacesPanel(props: {
  places: PlaceListItem[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelectGuide: (guide: { id: number; name: string }) => void;
  className?: string;
}) {
  const { places, loading, selectedId, onSelect, hasMore, onLoadMore, onSelectGuide, className } = props;
  // controlled so picking a guide drops the user on the filtered places list
  const [tab, setTab] = useState('places');
  const { user } = useAuth();

  const mainList = (
    <ListShell loading={loading} empty={places.length === 0} hasMore={hasMore} onLoadMore={onLoadMore}>
      {places.map((p) => (
        <PlaceCard key={p.id} place={p} onClick={onSelect} />
      ))}
    </ListShell>
  );

  return (
    <div dir="rtl" className={cn('flex flex-col overflow-hidden bg-background', className)}>
      {selectedId !== null ? (
        <PlaceDetailView placeId={selectedId} onClose={() => onSelect(null)} />
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className={cn('mx-3 mt-3 grid', user ? 'grid-cols-4' : 'grid-cols-2')}>
            <TabsTrigger value="places">الأماكن</TabsTrigger>
            {user && <TabsTrigger value="saves">محفوظاتي</TabsTrigger>}
            {user && <TabsTrigger value="mine">مساهماتي</TabsTrigger>}
            <TabsTrigger value="guides">مرشدون</TabsTrigger>
          </TabsList>
          <TabsContent value="places" className="mt-0 flex min-h-0 flex-1 flex-col">
            {mainList}
          </TabsContent>
          {user && (
            <TabsContent value="saves" className="mt-0 flex min-h-0 flex-1 flex-col">
              <SavesTab onSelect={onSelect} />
            </TabsContent>
          )}
          {user && (
            <TabsContent value="mine" className="mt-0 flex min-h-0 flex-1 flex-col">
              <MineTab onSelect={onSelect} />
            </TabsContent>
          )}
          <TabsContent value="guides" className="mt-0 flex min-h-0 flex-1 flex-col">
            {/* heading المرشدون المحليون renders inside GuidesTab; it scrolls itself */}
            <GuidesTab onSelectGuide={(g) => { onSelectGuide(g); setTab('places'); }} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
