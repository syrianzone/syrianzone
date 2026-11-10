import { useEffect, useState } from 'react';
import { cn } from '@/Lib/utils';
import { calendarCounterCaption, dayWord, daysPhrase, hoursPhrase, minutesPhrase } from '../_lib/format';
import { STATE_META, isOpenState } from '../_lib/status';
import type { PromiseCounter, PromiseState } from '../_lib/types';

interface Props {
    state: PromiseState;
    counter: PromiseCounter;
    /** Date-only anchors for the calendar caption; deadline also drives the live clock. */
    deadlineDate?: string | null;
    statementDate?: string;
    size?: 'md' | 'lg';
    /** Adds a ticking days/hours/minutes clock under the number (detail page). */
    live?: boolean;
}

/** How each verdict is said in a sentence ("تحقق بعد الموعد بـ…"). */
const VERDICT: Partial<Record<PromiseState, string>> = {
    fulfilled: 'تحقق',
    partially_fulfilled: 'تحقق جزئياً',
    broken: 'حُكم بأنه لم يتحقق',
    postponed: 'أُجّل',
    retracted: 'سُحب',
};

/** The caption under the numeral, and the full sentence for screen readers. */
function describe(state: PromiseState, { mode, value }: PromiseCounter): { caption: string; spoken: string } {
    const n = value ?? 0;
    const word = dayWord(n);
    const days = daysPhrase(n);
    const verdict = VERDICT[state] ?? STATE_META[state].label;

    switch (mode) {
        case 'left': return { caption: `${word} حتى الموعد`, spoken: `بقي ${days} حتى الموعد` };
        case 'today': return { caption: 'الموعد اليوم', spoken: 'الموعد اليوم' };
        case 'overdue': return { caption: `${word} من التأخير`, spoken: `تجاوز الموعد بـ${days}` };
        case 'since': return { caption: `${word} منذ إطلاق الوعد`, spoken: `مضى ${days} منذ إطلاق الوعد` };
        case 'early': return { caption: `${word} قبل الموعد`, spoken: `${verdict} قبل الموعد بـ${days}` };
        case 'ontime': return { caption: 'في يوم الموعد', spoken: `${verdict} في يوم الموعد` };
        case 'late': return { caption: `${word} بعد الموعد`, spoken: `${verdict} بعد الموعد بـ${days}` };
        case 'took': return { caption: `${word} بعد إطلاقه`, spoken: `${verdict} بعد ${days} من إطلاقه` };
        case 'closed': return { caption: STATE_META[state].label, spoken: verdict };
    }
}

/**
 * The big number on a promise. Its meaning comes from the server
 * (Promise::counter) so every surface agrees: open promises count down, or up
 * once overdue; closed ones freeze on the verdict date.
 * Whole days are computed in Syrian time server-side; the live clock only
 * starts after hydration so the server render and the client match.
 *
 * The visual is aria-hidden and a single sr-only sentence carries the meaning,
 * so screen readers hear "بقي 47 يوماً حتى الموعد", not "47" then a caption.
 */
export default function Countdown({ state, counter, deadlineDate, statementDate, size = 'md', live = false }: Props) {
    const open = isOpenState(state);
    const { caption, spoken } = describe(state, counter);
    const calendarCaption = calendarCounterCaption(counter, { deadlineDate, statementDate });
    const Icon = STATE_META[state].icon;

    return (
        <div className="flex flex-col items-center text-center">
            <span className="sr-only">{spoken}</span>
            {counter.value === null ? (
                <Icon aria-hidden="true" className={cn(size === 'lg' ? 'h-16 w-16' : 'h-12 w-12', STATE_META[state].tone)} />
            ) : (
                <span
                    aria-hidden="true"
                    dir="ltr"
                    className={cn(
                        'font-black leading-none tabular-nums',
                        size === 'lg' ? 'text-6xl md:text-7xl' : 'text-5xl',
                        open ? STATE_META[state].tone : 'text-muted-foreground',
                    )}
                >
                    {counter.mode === 'overdue' ? `+${counter.value}` : counter.value}
                </span>
            )}
            <span aria-hidden="true" className="mt-1.5 text-sm font-medium text-muted-foreground">{calendarCaption ?? caption}</span>
            {live && counter.mode === 'left' && deadlineDate && <LiveClock deadlineDate={deadlineDate} />}
        </div>
    );
}

const DAMASCUS_OFFSET_MINUTES = 3 * 60; // Syria has been on UTC+3 year-round since 2022.

/** Time left until the end of the deadline day in Syria, as days/hours/minutes. */
function LiveClock({ deadlineDate }: { deadlineDate: string }) {
    const [now, setNow] = useState<number | null>(null);

    useEffect(() => {
        setNow(Date.now());
        const id = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(id);
    }, []);

    if (now === null) return null;

    const [y, m, d] = deadlineDate.split('-').map(Number);
    // End of the deadline day (23:59:59) in Syrian time, as a UTC instant.
    const end = Date.UTC(y, m - 1, d, 23, 59, 59) - DAMASCUS_OFFSET_MINUTES * 60_000;
    const diff = Math.max(0, end - now);
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const parts: Array<[string, string]> = [[String(days), 'يوم'], [pad(hours), 'ساعة'], [pad(minutes), 'دقيقة']];

    return (
        <div className="mt-4 flex items-stretch gap-2">
            <span className="sr-only">
                {`الوقت المتبقي: ${daysPhrase(days)} و${hoursPhrase(hours)} و${minutesPhrase(minutes)}`}
            </span>
            {parts.map(([value, unit]) => (
                <span key={unit} aria-hidden="true" className="flex min-w-14 flex-col items-center rounded-md border border-border bg-muted/60 px-2.5 py-1.5">
                    <span className="text-lg font-bold leading-tight tabular-nums text-foreground" dir="ltr">{value}</span>
                    <span className="text-[11px] text-muted-foreground">{unit}</span>
                </span>
            ))}
        </div>
    );
}
