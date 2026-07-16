import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/Contexts/AuthContext';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/Lib/utils';
import { api } from '../_lib/api';
import type { MyPlace, Paginated, PlaceListItem, PlaceStatus } from '../_lib/types';
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
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
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
  return (
    <ListShell loading={loading} empty={items.length === 0} hasMore={hasMore} onLoadMore={loadMore} failed={failed} onRetry={reload}>
      {items.map((p) => (
        <div key={p.id} className="space-y-1">
          <PlaceCard place={p} onClick={props.onSelect} />
          <div className="flex items-start gap-2 px-1">
            <Badge variant={STATUS_VARIANTS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
            {p.status === 'rejected' && p.rejection_reason && (
              <p className="text-xs text-muted-foreground">{p.rejection_reason}</p>
            )}
          </div>
        </div>
      ))}
    </ListShell>
  );
}

export function PlacesPanel(props: {
  places: PlaceListItem[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  className?: string;
}) {
  const { places, loading, selectedId, onSelect, hasMore, onLoadMore, className } = props;
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
      ) : user ? (
        <Tabs defaultValue="places" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-3 mt-3 grid grid-cols-3">
            <TabsTrigger value="places">الأماكن</TabsTrigger>
            <TabsTrigger value="saves">محفوظاتي</TabsTrigger>
            <TabsTrigger value="mine">مساهماتي</TabsTrigger>
          </TabsList>
          <TabsContent value="places" className="mt-0 flex min-h-0 flex-1 flex-col">
            {mainList}
          </TabsContent>
          <TabsContent value="saves" className="mt-0 flex min-h-0 flex-1 flex-col">
            <SavesTab onSelect={onSelect} />
          </TabsContent>
          <TabsContent value="mine" className="mt-0 flex min-h-0 flex-1 flex-col">
            <MineTab onSelect={onSelect} />
          </TabsContent>
        </Tabs>
      ) : (
        mainList
      )}
    </div>
  );
}
