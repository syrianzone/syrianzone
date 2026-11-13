import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader } from '@/Components/ui/card';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { usePromiseVote } from '../_lib/useVote';
import type { PromiseVotes } from '@/Domain/promises/types';

interface Props {
    number: number;
    votes: PromiseVotes;
    open: boolean;
}

/**
 * "Will it be kept?" — a one-tap public poll, in full on the detail page.
 * The list cards carry the same poll as CardVote.
 */
export default function VotePanel({ number, votes: initial, open }: Props) {
    const { votes, total, yesPct, mine, busy, cast } = usePromiseVote(number, initial);

    return (
        <Card>
            <CardHeader className="pb-3">
                <h2 className="text-base font-semibold leading-none">هل تعتقد أن هذا الوعد سيتحقق؟</h2>
            </CardHeader>
            <CardContent className="space-y-4">
                {open ? (
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant={mine === true ? 'default' : 'outline'}
                            aria-pressed={mine === true}
                            disabled={busy}
                            onClick={() => cast(true)}
                            className="gap-2"
                        >
                            <ThumbsUp className="h-4 w-4" aria-hidden="true" />سيتحقق
                        </Button>
                        <Button
                            variant={mine === false ? 'default' : 'outline'}
                            aria-pressed={mine === false}
                            disabled={busy}
                            onClick={() => cast(false)}
                            className="gap-2"
                        >
                            <ThumbsDown className="h-4 w-4" aria-hidden="true" />لن يتحقق
                        </Button>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {total > 0 ? 'أُغلق التصويت بعد حسم الوعد، وهذه نتيجته النهائية:' : 'أُغلق التصويت بعد حسم الوعد، ولم يصوّت أحد قبل ذلك.'}
                    </p>
                )}

                {total > 0 ? (
                    <div className="space-y-1.5">
                        <div
                            className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                            role="img"
                            aria-label={`سيتحقق: ${votes.yes}، لن يتحقق: ${votes.no}`}
                        >
                            <div className="h-full bg-primary" style={{ width: `${yesPct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>سيتحقق: <span className="font-semibold tabular-nums text-foreground">{votes.yes}</span> (<span dir="ltr">{yesPct}%</span>)</span>
                            <span>لن يتحقق: <span className="font-semibold tabular-nums text-foreground">{votes.no}</span></span>
                        </div>
                    </div>
                ) : (
                    open && <p className="text-xs text-muted-foreground">كن أول من يصوّت.</p>
                )}
            </CardContent>
        </Card>
    );
}
