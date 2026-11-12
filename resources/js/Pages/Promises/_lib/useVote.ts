import { useEffect, useState } from 'react';
import axios from '@/Lib/axios';
import { notify } from '@/Lib/notify';
import { extractApiErrorMessage } from '@/Lib/apiError';
import { getDeviceId } from '@/Lib/deviceId';
import type { PromiseVotes } from './types';

const storageKey = (n: number) => `promise-vote:${n}`;

const snapshot = (votes: PromiseVotes) => `${votes.yes}:${votes.no}`;

/**
 * Tallies returned by this visitor's own votes, kept for the session. Going
 * Back restores a page's props from history, which predate the vote; the
 * card would then show the visitor's answer against a count that leaves it
 * out. Each entry remembers which prop values it replaced, so it overrides
 * only those: props it has not seen came from the server after the vote and
 * win, even when the total is unchanged (another voter changed their answer).
 * Written only from the click handler, so it is never shared between
 * server-rendered requests.
 */
const seen = new Map<number, { votes: PromiseVotes; replaced: Set<string> }>();

/** The tally to show: the visitor's own latest one if `fromProps` is a value it replaced. */
export function newestVotes(number: number, fromProps: PromiseVotes): PromiseVotes {
    const mine = seen.get(number);
    return mine?.replaced.has(snapshot(fromProps)) ? mine.votes : fromProps;
}

/** Record the tally a vote returned, and the prop values it makes stale. */
export function rememberVotes(number: number, votes: PromiseVotes, fromProps: PromiseVotes): void {
    const replaced = seen.get(number)?.replaced ?? new Set<string>();
    replaced.add(snapshot(fromProps));
    // A fresh page may legitimately carry the tally this vote returned.
    replaced.delete(snapshot(votes));
    seen.set(number, { votes, replaced });
}

/**
 * The "will it be kept?" vote for one promise, shared by the detail panel and
 * the list cards. The visitor's own answer is remembered in this browser
 * only; the server stores an HMAC, never the device id or IP, and returns
 * the aggregate.
 */
export function usePromiseVote(number: number, initial: PromiseVotes) {
    const [votes, setVotes] = useState(() => newestVotes(number, initial));
    const [mine, setMine] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);

    // Read after mount so the server render and the first client render match.
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey(number));
            if (saved !== null) setMine(saved === '1');
        } catch {
            /* storage unavailable: the buttons still work, the choice is just not remembered */
        }
    }, [number]);

    const cast = async (believes: boolean) => {
        if (busy || mine === believes) return;
        setBusy(true);
        try {
            const res = await axios.post(`/api/v1/promises/${number}/vote`, { believes, device_id: getDeviceId() });
            rememberVotes(number, res.data.votes, initial);
            setVotes(res.data.votes);
            setMine(believes);
            try {
                localStorage.setItem(storageKey(number), believes ? '1' : '0');
            } catch {
                /* storage unavailable */
            }
            notify.success('سُجّل رأيك');
        } catch (e) {
            notify.error(extractApiErrorMessage(e, 'تعذّر تسجيل رأيك'));
        } finally {
            setBusy(false);
        }
    };

    const total = votes.yes + votes.no;
    const yesPct = total > 0 ? Math.round((votes.yes / total) * 100) : 0;

    return { votes, total, yesPct, mine, busy, cast };
}
