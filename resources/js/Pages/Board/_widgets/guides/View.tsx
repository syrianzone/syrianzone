import { Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/Components/ui/avatar';
import { discovery } from '@/Pages/Places/_lib/discovery';
import { WidgetShell } from '../../_components/WidgetShell';
import { useWidgetQuery } from '../../_lib/query';
import type { WidgetProps } from '../../_lib/types';
import { guidesWidget, type GuidesConfig } from './index';

// Reuses the Places discovery client rather than restating the endpoint.
export default function GuidesView({ config }: WidgetProps<GuidesConfig>) {
  const sort = config.sort ?? 'submissions';
  const query = useWidgetQuery(guidesWidget, sort, () => discovery.guides(sort));
  const guides = query.data?.guides ?? [];

  return (
    <WidgetShell
      title="المرشدون"
      icon={Users}
      loading={query.isPending}
      refreshing={query.isFetching && !query.isPending}
      error={query.isError ? 'تعذر تحميل المرشدين' : null}
      onRetry={() => query.refetch()}
      empty={!query.isPending && !query.isError && guides.length === 0}
      emptyText="لا يوجد مساهمون بعد"
    >
      <ul className="divide-y divide-border">
        {guides.map((g) => (
          <li key={g.user_id}>
            <a href={`/mishwar?guide=${g.user_id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50">
              <span dir="ltr" className="w-4 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                {g.rank}
              </span>
              <Avatar className="h-7 w-7">
                <AvatarImage src={g.avatar_url ?? undefined} alt={g.name} />
                <AvatarFallback>{g.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  {g.approved_count} مساهمة · {g.saves_total} حفظ
                </p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
