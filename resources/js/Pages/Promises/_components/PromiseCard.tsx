import { Link, router, usePage } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/card';
import { CalendarDays } from 'lucide-react';
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
 */
export default function PromiseCard({ promise, returnUrl = '/promises' }: { promise: PromiseCardData; returnUrl?: string }) {
    const sourcePage = usePage();
    const SectorIcon = sectorIcon(promise.sector?.icon);

    return (
        <Card className="group relative flex h-full flex-col transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring">
            <CardContent className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <SpeakerAvatar name={promise.speaker.name} image={promise.speaker.image} size={40} />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{promise.speaker.name}</p>
                            {promise.speaker.title && (
                                <p className="truncate text-xs text-muted-foreground">{promise.speaker.title}</p>
                            )}
                        </div>
                    </div>
                    <StateBadge state={promise.state} keptLate={promise.keptLate} />
                </div>

                <h2 className="text-base font-bold leading-snug text-foreground">
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

                <div className="flex flex-1 items-center justify-center py-1">
                    <Countdown state={promise.state} counter={promise.counter} deadlineDate={promise.deadlineDate} statementDate={promise.statementDate} />
                </div>

                {promise.target && <TargetProgress target={promise.target} />}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {promise.deadlineDate ? `الموعد ${formatDate(promise.deadlineDate)}` : 'بلا موعد محدد'}
                    </span>
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
        </Card>
    );
}
