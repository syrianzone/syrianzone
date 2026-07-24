import { Rss } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import { useWidgetQuery } from '../../_lib/query';
import { sources } from '../../_lib/sources';
import type { WidgetProps } from '../../_lib/types';
import { rssWidget, RSS_SOURCES, type RssConfig } from './index';

// Short numeric date, so a long arabic headline keeps the width.
function shortDate(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  return `${String(at.getDate()).padStart(2, '0')}/${String(at.getMonth() + 1).padStart(2, '0')}`;
}

export default function RssView({ config }: WidgetProps<RssConfig>) {
  const source = config.source ?? 'jard';
  const query = useWidgetQuery(rssWidget, source, () => sources.feed(source));
  const items = query.data?.items ?? [];

  const label = RSS_SOURCES.find((s) => s.value === source)?.label ?? 'الأخبار';

  return (
    <WidgetShell
      title={query.data?.title || label}
      icon={Rss}
      loading={query.isPending}
      refreshing={query.isFetching && !query.isPending}
      error={query.isError ? 'تعذر تحميل الأخبار' : null}
      onRetry={() => query.refetch()}
      empty={!query.isPending && !query.isError && items.length === 0}
      emptyText="لا توجد أخبار"
    >
      <ul className="divide-y divide-border">
        {items.map((item, i) => (
          <li key={`${item.link ?? item.title}-${i}`}>
            <a
              href={item.link ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2 px-3 py-2 hover:bg-accent/50"
            >
              <span className="min-w-0 flex-1 text-sm leading-snug text-foreground">{item.title}</span>
              {item.published_at && (
                <span dir="ltr" className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                  {shortDate(item.published_at)}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
