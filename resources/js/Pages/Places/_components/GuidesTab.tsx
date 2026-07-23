import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { discovery, type Guide, type GuidesSort } from '../_lib/discovery';
import { LevelBadge } from './LevelBadge';
import { MilestonesSheet } from './MilestonesSheet';

const SORTS: { value: GuidesSort; label: string }[] = [
  { value: 'submissions', label: 'الأكثر مساهمة' },
  { value: 'saves', label: 'الأكثر حفظاً' },
  { value: 'recent', label: 'النشطون مؤخراً' },
];

export function GuidesTab(props: { onSelectGuide: (guide: { id: number; name: string }) => void }) {
  const [sort, setSort] = useState<GuidesSort>('submissions');
  const [guides, setGuides] = useState<Guide[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const id = ++requestRef.current;
    setGuides(null);
    setError(false);
    discovery.guides(sort)
      .then((res) => {
        if (id === requestRef.current) setGuides(res.guides);
      })
      .catch(() => {
        if (id === requestRef.current) setError(true);
      });
  }, [sort, attempt]);

  return (
    <div dir="rtl" className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">المرشدون المحليون</h3>
        <Button type="button" variant="ghost" size="sm" onClick={() => setMilestonesOpen(true)}>
          الرتب
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={sort === s.value}
            onClick={() => setSort(s.value)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              sort === s.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {error && (
        <div className="flex flex-col items-center gap-2 py-6">
          <p className="text-sm text-destructive">تعذر تحميل المرشدين</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
            إعادة المحاولة
          </Button>
        </div>
      )}
      {!error && guides === null && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!error && guides !== null && guides.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">لا يوجد مساهمون بعد</p>
      )}
      {!error && guides !== null && guides.length > 0 && (
        <ul className="space-y-1">
          {guides.map((g) => (
            <li key={g.user_id}>
              <button
                type="button"
                onClick={() => props.onSelectGuide({ id: g.user_id, name: g.name })}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-right hover:bg-accent/50"
              >
              <span dir="ltr" className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                {g.rank}
              </span>
              <Avatar className="h-8 w-8">
                <AvatarImage src={g.avatar_url ?? undefined} alt={g.name} />
                <AvatarFallback>{g.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <span className="truncate">{g.name}</span>
                  <LevelBadge level={g.level} showLabel />
                </p>
                <p className="text-xs text-muted-foreground">
                  {g.points} نقطة · {g.approved_count} مساهمة · {g.saves_total} حفظ
                  {sort === 'recent' && ` · ${g.recent_count} خلال 30 يوماً`}
                </p>
              </div>
                <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <MilestonesSheet open={milestonesOpen} onOpenChange={setMilestonesOpen} />
    </div>
  );
}
