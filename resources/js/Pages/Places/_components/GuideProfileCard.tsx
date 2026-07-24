import { MapPin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { Guide } from '../_lib/discovery';
import { LevelBadge, RANK_NAMES, rankName } from './LevelBadge';

// next threshold above the guide's points, or null at the top rank
function nextRank(points: number): { level: number; points: number } | null {
  const thresholds: [number, number][] = [
    [2, 15], [3, 75], [4, 250], [5, 500], [6, 1500],
    [7, 5000], [8, 15000], [9, 50000], [10, 100000],
  ];
  for (const [level, required] of thresholds) {
    if (points < required) return { level, points: required };
  }
  return null;
}

export function GuideProfileCard(props: {
  guide: Guide | null;
  onOpenChange: (open: boolean) => void;
  onShowContributions: (guide: { id: number; name: string }) => void;
}) {
  const { guide, onOpenChange, onShowContributions } = props;
  if (!guide) return null;
  const next = nextRank(guide.points);
  const progress = next ? Math.min(100, Math.round((guide.points / next.points) * 100)) : 100;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogTitle className="sr-only">{guide.name}</DialogTitle>
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <Avatar className="h-20 w-20">
            <AvatarImage src={guide.avatar_url ?? undefined} alt={guide.name} />
            <AvatarFallback className="text-2xl">{guide.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-bold text-foreground">{guide.name}</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <LevelBadge level={guide.level} showLabel />
            </div>
          </div>

          <p className="text-3xl font-bold tabular-nums text-foreground">
            {guide.points}
            <span className="ms-1 text-sm font-normal text-muted-foreground">نقطة</span>
          </p>

          <div className="grid w-full grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-secondary/50 p-2">
              <p className="text-sm font-bold tabular-nums">{guide.approved_count}</p>
              <p className="text-xs text-muted-foreground">مساهمة</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <p className="text-sm font-bold tabular-nums">{guide.saves_total}</p>
              <p className="text-xs text-muted-foreground">حفظ</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <p className="text-sm font-bold tabular-nums">{guide.recent_count}</p>
              <p className="text-xs text-muted-foreground">آخر 30 يوماً</p>
            </div>
          </div>

          {next ? (
            <div className="w-full">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>{rankName(guide.level)}</span>
                <span>
                  {RANK_NAMES[next.level]} عند <span dir="ltr" className="tabular-nums">{next.points}</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">أعلى رتبة، {rankName(guide.level)}</p>
          )}

          <Button
            type="button"
            className="w-full"
            onClick={() => onShowContributions({ id: guide.user_id, name: guide.name })}
          >
            <MapPin />
            عرض المساهمات على الخريطة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
