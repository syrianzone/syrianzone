import { Button } from '@/Components/ui/button';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { cn } from '@/Lib/utils';
import { voteCount } from '@/Domain/promises/format';
import { usePromiseVote } from '../_lib/useVote';
import type { PromiseVotes } from '@/Domain/promises/types';

interface Props {
    number: number;
    votes: PromiseVotes;
    open: boolean;
    className?: string;
}

/** Below this many votes a percentage says nothing, so only the count is shown. */
export const MIN_VOTES_FOR_SPLIT = 5;

const ANSWERS = [
    { believes: true, label: 'نعم', Icon: ThumbsUp },
    { believes: false, label: 'لا', Icon: ThumbsDown },
];

/**
 * The "will it be kept?" vote on a list card: the detail page's VotePanel
 * reduced to one quiet line, so it never competes with the countdown.
 *
 * The line asks the question; once the visitor has answered (or the promise
 * is settled) the same line reports the result instead. Showing the split
 * only after an answer keeps the card from suggesting one. It sits above the
 * card's stretched title link, hence `relative z-10`.
 */
export default function CardVote({ number, votes: initial, open, className }: Props) {
    const { total, yesPct, mine, busy, cast } = usePromiseVote(number, initial);
    const split = total >= MIN_VOTES_FOR_SPLIT && (
        <>
            <span className="font-semibold tabular-nums text-foreground" dir="ltr">{yesPct}%</span>
            {open ? ' قالوا نعم' : ' توقعوا أن يتحقق'}
            <span aria-hidden="true"> · </span>
        </>
    );

    if (!open) {
        if (!split) return null;
        return <p className={cn('relative z-10 text-xs text-muted-foreground', className)}>{split}{voteCount(total)}</p>;
    }

    return (
        <div
            role="group"
            aria-label={`هل سيتحقق الوعد رقم ${number}؟`}
            className={cn('relative z-10 flex items-center justify-between gap-3 text-xs text-muted-foreground', className)}
        >
            <p className="min-w-0 truncate">
                {mine === null ? <span className="text-foreground">هل سيتحقق هذا الوعد؟</span> : <>{split || <>سُجّل رأيك<span aria-hidden="true"> · </span></>}{voteCount(total)}</>}
            </p>
            <div className="-me-1.5 flex shrink-0 gap-1">
                {ANSWERS.map(({ believes, label, Icon }) => (
                    <Button
                        key={label}
                        variant="ghost"
                        size="sm"
                        aria-pressed={mine === believes}
                        disabled={busy}
                        onClick={() => cast(believes)}
                        className={cn('h-8 gap-1.5 px-2.5 text-xs', mine === believes ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground')}
                    >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
