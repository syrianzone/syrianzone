import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, Loader2, X } from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/Components/ui/dialog';
import { ScrollArea } from '@/Components/ui/scroll-area';
import { Separator } from '@/Components/ui/separator';
import { fetchFakeNewsStats } from '@/Domain/fakenewstest/api';
import { FAKE_NEWS_CLAIMS, getAllClaimOutcomeStats, ROUND_SIZE } from '@/Domain/fakenewstest/claims';
import type { FakeNewsStats } from '@/Domain/fakenewstest/types';
import { cn } from '@/Lib/utils';
import BdiText from './BdiText';
import KindBadge from './KindBadge';

interface ClaimStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: FakeNewsStats | null;
  onStatsRefresh?: (fresh: FakeNewsStats) => void;
}

type SortMode = 'hardest' | 'easiest';

const SORT_OPTIONS: ReadonlyArray<{ value: SortMode; label: string }> = [
  { value: 'hardest', label: 'الأصعب أولاً' },
  { value: 'easiest', label: 'الأسهل أولاً' },
];

export default function ClaimStatsDialog({
  open,
  onOpenChange,
  stats,
  onStatsRefresh,
}: ClaimStatsDialogProps) {
  const [sortMode, setSortMode] = useState<SortMode>('hardest');
  const [loading, setLoading] = useState(false);
  // Empty until the visitor reorders, so opening the dialog announces nothing extra.
  const [sortAnnouncement, setSortAnnouncement] = useState('');

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    fetchFakeNewsStats(controller.signal)
      .then((fresh) => {
        onStatsRefresh?.(fresh);
      })
      .catch(() => {
        /* keep existing snapshot if refresh fails */
      })
      .finally(() => {
        setLoading(false);
      });
    return () => controller.abort();
  }, [open, onStatsRefresh]);

  const rows = useMemo(() => {
    const items = getAllClaimOutcomeStats(stats);
    return items.toSorted((a, b) => {
      if (a.total === 0 && b.total === 0) return 0;
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return sortMode === 'hardest'
        ? b.failedPct - a.failedPct || b.total - a.total
        : b.wonPct - a.wonPct || b.total - a.total;
    });
  }, [stats, sortMode]);

  const poolSize = FAKE_NEWS_CLAIMS.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden" dir="rtl">
        <DialogHeader className="p-5 pb-3 text-start">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <BarChart3 className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
            <span>إحصاءات الأسئلة</span>
            <Badge variant="secondary" className="text-[11px] font-semibold">
              <bdi dir="ltr">{poolSize}</bdi>
            </Badge>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {stats && stats.total_runs > 0 ? (
              <>
                <bdi dir="ltr" className="font-semibold text-foreground">
                  {stats.total_runs.toLocaleString('en-US')}
                </bdi>{' '}
                جولة مكتملة
                {stats.average_score !== null && (
                  <>
                    {' '}· المتوسّط{' '}
                    <bdi dir="ltr" className="font-semibold text-foreground">
                      {stats.average_score.toFixed(1)}/{ROUND_SIZE}
                    </bdi>
                  </>
                )}
              </>
            ) : (
              'نسبة من أصاب ومن أخطأ في كل ادّعاء.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-5 pb-3" role="group" aria-label="ترتيب الأسئلة">
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={sortMode === option.value ? 'default' : 'outline'}
              aria-pressed={sortMode === option.value}
              onClick={() => {
                setSortMode(option.value);
                setSortAnnouncement(`رُتّبت الأسئلة: ${option.label}`);
              }}
            >
              {option.label}
            </Button>
          ))}
          <span className="sr-only" role="status" aria-live="polite">
            {sortAnnouncement}
          </span>
        </div>

        <Separator />

        <ScrollArea className="max-h-[65svh]">
          <div className="space-y-3 p-5">
            {rows.map(({ claim, wonCount, failedCount, total, wonPct, failedPct }) => (
              <Card key={claim.id}>
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <KindBadge kind={claim.kind} />
                      <Badge
                        variant={claim.answer ? 'secondary' : 'destructive'}
                        className={cn(
                          'text-[11px] font-bold',
                          claim.answer &&
                            'border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                        )}
                      >
                        {claim.label}
                      </Badge>
                    </div>

                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      <bdi dir="ltr">{total.toLocaleString('en-US')}</bdi> إجابة
                    </span>
                  </div>

                  <p className="text-sm font-semibold leading-relaxed text-foreground">
                    <BdiText text={claim.text} />
                  </p>

                  {total > 0 ? (
                    <div className="space-y-1.5 pt-0.5">
                      <div
                        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
                        role="img"
                        aria-label={`أصاب ${wonPct}% وأخطأ ${failedPct}%`}
                      >
                        {wonPct > 0 && (
                          <div className="h-full bg-emerald-500" style={{ width: `${wonPct}%` }} />
                        )}
                        {failedPct > 0 && (
                          <div className="h-full bg-destructive" style={{ width: `${failedPct}%` }} />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>أصاب:</span>
                          <bdi dir="ltr" className="tabular-nums">
                            {wonCount.toLocaleString('en-US')} ({wonPct}%)
                          </bdi>
                        </span>

                        <span className="inline-flex items-center gap-1 text-destructive">
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>أخطأ:</span>
                          <bdi dir="ltr" className="tabular-nums">
                            {failedCount.toLocaleString('en-US')} ({failedPct}%)
                          </bdi>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">لا توجد إجابات بعد.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
