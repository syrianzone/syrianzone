import type { ReactNode } from 'react';
import { ArrowLeft, Archive, CalendarClock, ExternalLink, Flag } from 'lucide-react';
import StateBadge from './StateBadge';
import { formatDate, formatNumber, safeHref } from './format';
import { UPDATE_TYPE_LABEL, VENUE_LABEL } from './status';
import type { PromiseUpdateData } from './types';

interface Props {
    statementDate: string | null;
    statementVenue: string;
    updates: PromiseUpdateData[];
    /** Unit of the measurable target, printed after progress readings. */
    unit?: string | null;
    /** Per-entry controls (the admin change log); omitted on the public page. */
    actions?: (update: PromiseUpdateData) => ReactNode;
}

/**
 * The public change log, oldest first, opening with the statement itself.
 * Every status change and progress reading carries its source. The admin
 * editor renders the same component with per-entry actions.
 */
export default function Timeline({ statementDate, statementVenue, updates, unit, actions }: Props) {
    const suffix = unit ? ` ${unit}` : '';

    return (
        <ol className="relative space-y-6 border-s border-border ps-6">
            <li className="relative">
                <span className="absolute -start-[calc(2rem+0.5px)] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-background" aria-hidden="true">
                    <Flag className="h-2.5 w-2.5 text-primary-foreground" />
                </span>
                <p className="text-xs text-muted-foreground">{formatDate(statementDate)}</p>
                <p className="mt-1 font-semibold text-foreground">أُطلق الوعد</p>
                <p className="text-sm text-muted-foreground">{VENUE_LABEL[statementVenue] ?? ''}</p>
            </li>

            {updates.map((u) => {
                const source = safeHref(u.sourceUrl);
                const archive = safeHref(u.archiveUrl);
                return (
                    <li key={u.id} className="relative">
                        {u.type === 'deadline_change' ? (
                            <span className="absolute -start-[calc(2rem+0.5px)] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 ring-4 ring-background dark:text-amber-400" aria-hidden="true">
                                <CalendarClock className="h-2.5 w-2.5" />
                            </span>
                        ) : (
                            <span className="absolute -start-[calc(1.875rem+0.5px)] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" aria-hidden="true" />
                        )}
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    {u.type === 'deadline_change' && (
                                        <CalendarClock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                                    )}
                                    <span>
                                        {formatDate(u.happenedOn)} · {UPDATE_TYPE_LABEL[u.type] ?? (u.type === 'deadline_change' ? 'تأجيل الموعد' : u.type)}
                                    </span>
                                </p>
                                {u.type === 'status_change' && u.statusTo && (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                        {u.statusFrom && <StateBadge state={u.statusFrom} />}
                                        <ArrowLeft className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                        <span className="sr-only">إلى</span>
                                        <StateBadge state={u.statusTo} />
                                    </div>
                                )}
                                {u.type === 'progress' && u.value !== null && (
                                    <p className="mt-1 font-semibold text-foreground">
                                        القراءة: <span className="tabular-nums">{formatNumber(u.value)}</span>{suffix}
                                    </p>
                                )}
                                {u.type === 'deadline_change' && (
                                    <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                        <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                                        <span>تأجيل الموعد</span>
                                    </div>
                                )}
                                {u.body && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground">{u.body}</p>}
                                {(source || archive) && (
                                    <div className="mt-1.5 flex flex-wrap gap-x-4 text-sm">
                                        {source && (
                                            <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />المصدر
                                            </a>
                                        )}
                                        {archive && (
                                            <a href={archive} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline">
                                                <Archive className="h-3.5 w-3.5" aria-hidden="true" />نسخة مؤرشفة
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                            {actions && <div className="shrink-0">{actions(u)}</div>}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
