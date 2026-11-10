import { Link, router, usePage } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/card';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/Lib/utils';
import Countdown from './Countdown';
import SpeakerAvatar from './SpeakerAvatar';
import StateBadge from './StateBadge';
import TargetProgress from './TargetProgress';
import { formatDate } from '../_lib/format';
import { PROMISE_LIST_VISIT_KEY, promiseReturnUrl } from '../_lib/filters';
import { sectorIcon } from '../_lib/status';
import type { PromiseCardData } from '../_lib/types';

/**
 * One promise in the list. The title is the only link; it stretches over the
 * card so the whole card is clickable without nesting interactive elements.
 * The `list` layout is a full-width row with the counter beside the content;
 * on phones it shrinks to the speaker, state and title so rows stay short.
 */
export type PromiseCardLayout = 'grid' | 'list';

export default function PromiseCard({ promise, returnUrl = '/promises', layout = 'grid' }: { promise: PromiseCardData; returnUrl?: string; layout?: PromiseCardLayout }) {
    const sourcePage = usePage();
    const SectorIcon = sectorIcon(promise.sector?.icon);
    const list = layout === 'list';
    const coSpeakers = promise.coSpeakers ?? [];
    const allSpeakers = [promise.speaker, ...coSpeakers];
    const speakerNames = allSpeakers.map((s) => s.name).filter(Boolean).join(' و');
    const speakerTitles = allSpeakers.map((s) => s.title).filter(Boolean).join(' · ');
    const countdown = (
        <Countdown state={promise.state} counter={promise.counter} deadlineDate={promise.deadlineDate} statementDate={promise.statementDate} size={list ? 'sm' : 'md'} />
    );

    return (
        <Card className={cn('group relative flex h-full transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring', list ? 'flex-row' : 'flex-col')}>
            <CardContent className={cn('flex flex-1 flex-col', list ? 'min-w-0 gap-1.5 p-3 sm:gap-3 sm:p-5' : 'gap-4 p-5')}>
                <div className={cn('flex justify-between gap-3', list ? 'items-center' : 'items-start')}>
                    <div className="flex min-w-0 items-center gap-2.5">
                        {coSpeakers.length > 0 ? (
                            <div className={cn('flex shrink-0 items-center', list && 'max-sm:hidden')}>
                                {allSpeakers.map((s, idx) => (
                                    <SpeakerAvatar
                                        key={s.id ?? idx}
                                        name={s.name}
                                        image={s.image}
                                        size={38}
                                        className={cn('ring-2 ring-card', idx > 0 && '-ms-2.5')}
                                    />
                                ))}
                            </div>
                        ) : (
                            <SpeakerAvatar name={promise.speaker.name} image={promise.speaker.image} size={40} className={cn(list && 'max-sm:hidden')} />
                        )}
                        <div className="min-w-0">
                            <p className={cn('truncate font-semibold', list ? 'text-xs text-muted-foreground sm:text-sm sm:text-foreground' : 'text-sm text-foreground')}>{speakerNames}</p>
                            {speakerTitles && (
                                <p className={cn('truncate text-xs text-muted-foreground', list && 'max-sm:hidden')}>{speakerTitles}</p>
                            )}
                        </div>
                    </div>
                    <StateBadge state={promise.state} keptLate={promise.keptLate} className={cn(list && 'max-sm:px-2 max-sm:py-0 max-sm:text-[11px]')} />
                </div>

                <h2 className={cn('font-bold leading-snug text-foreground', list ? 'line-clamp-2 text-sm sm:text-base' : 'text-base')}>
                    <Link
                        href={`/promises/${promise.number}${returnUrl === '/promises' ? '' : `?from=${encodeURIComponent(returnUrl)}`}`}
                        onSuccess={(page) => {
                            if (sourcePage.component === 'Promises/Index' && sourcePage.url.split('?')[0] === '/promises'
                                && page.component === 'Promises/Show' && page.url.split('?')[0] === `/promises/${promise.number}`
                                && promiseReturnUrl(page.url) === returnUrl) {
                                router.remember({ detailUrl: page.url, listUrl: returnUrl }, PROMISE_LIST_VISIT_KEY);
                            }
                        }}
                        className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:text-primary"
                    >
                        {promise.title}
                    </Link>
                </h2>

                {!list && <div className="flex flex-1 items-center justify-center py-1">{countdown}</div>}

                {promise.target && <div className={cn(list && 'max-sm:hidden')}><TargetProgress target={promise.target} /></div>}

                <div className={cn('flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground', list && 'max-sm:hidden')}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                            {promise.deadlineDate ? `الموعد ${formatDate(promise.deadlineDate)}` : 'بلا موعد محدد'}
                        </span>
                        {(promise.postponedCount ?? 0) > 0 && promise.originalDeadlineDate && (
                            <span className="text-muted-foreground/80">
                                الموعد الأصلي: <span className="line-through">{formatDate(promise.originalDeadlineDate)}</span>
                            </span>
                        )}
                    </div>
                    <span className="inline-flex items-center gap-2">
                        {promise.sector && (
                            <span className="inline-flex items-center gap-1">
                                <SectorIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                {promise.sector.label}
                            </span>
                        )}
                        <span className="tabular-nums" dir="ltr">#{promise.number}</span>
                    </span>
                </div>
            </CardContent>
            {list && (
                <div className="flex w-20 shrink-0 items-center justify-center border-s border-border px-1.5 py-2 sm:w-40 sm:px-2 sm:py-4">{countdown}</div>
            )}
        </Card>
    );
}
