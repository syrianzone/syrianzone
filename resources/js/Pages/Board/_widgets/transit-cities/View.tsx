import { Bus } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import { useWidgetQuery } from '../../_lib/query';
import { sources } from '../../_lib/sources';
import type { WidgetProps } from '../../_lib/types';
import { transitCitiesWidget } from './index';

export default function TransitCitiesView(_props: WidgetProps<Record<string, never>>) {
  const query = useWidgetQuery(transitCitiesWidget, null, () => sources.transitCities());
  const cities = query.data ?? [];

  return (
    <WidgetShell
      title="المواصلات"
      icon={Bus}
      loading={query.isPending}
      refreshing={query.isFetching && !query.isPending}
      error={query.isError ? 'تعذر تحميل المدن' : null}
      onRetry={() => query.refetch()}
      empty={!query.isPending && !query.isError && cities.length === 0}
      emptyText="لا توجد مدن متاحة"
    >
      <ul className="divide-y divide-border">
        {cities.map((c) => (
          <li key={c.id}>
            <a href={`/transit/city/${c.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{c.name_ar}</span>
              <span dir="ltr" className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {c.routeCount} خط
              </span>
            </a>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
