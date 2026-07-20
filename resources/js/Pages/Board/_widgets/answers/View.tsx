import { MessageCircleQuestion } from 'lucide-react';
import { WidgetShell } from '../../_components/WidgetShell';
import { useWidgetQuery } from '../../_lib/query';
import { sources } from '../../_lib/sources';
import type { WidgetProps } from '../../_lib/types';
import { answersWidget, type AnswersConfig } from './index';

// Links leave the app for answers.syrian.zone, so every anchor is target blank
// with rel noreferrer. The href is built server-side and arrives absolute.
export default function AnswersView({ config }: WidgetProps<AnswersConfig>) {
  const limit = config.limit ?? 8;
  const query = useWidgetQuery(answersWidget, limit, () => sources.answers(limit));
  const questions = query.data ?? [];

  return (
    <WidgetShell
      title="إجابات سوريا"
      icon={MessageCircleQuestion}
      loading={query.isPending}
      refreshing={query.isFetching && !query.isPending}
      error={query.isError ? 'تعذر تحميل الأسئلة' : null}
      onRetry={() => query.refetch()}
      empty={!query.isPending && !query.isError && questions.length === 0}
      emptyText="لا توجد أسئلة بعد"
    >
      <ul className="divide-y divide-border">
        {questions.map((q) => (
          <li key={q.id}>
            <a
              href={q.url}
              target="_blank"
              rel="noreferrer"
              className="block px-3 py-2 hover:bg-accent/50"
            >
              <p className="line-clamp-2 text-sm text-foreground">{q.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {q.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-muted px-1.5 py-0.5 text-[11px] leading-tight text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
                <span className="text-xs text-muted-foreground">
                  <span dir="ltr" className="tabular-nums">{q.answer_count}</span> إجابة
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
