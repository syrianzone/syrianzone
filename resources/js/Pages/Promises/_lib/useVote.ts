import { useEffect, useState } from 'react';
import axios from '@/Lib/axios';
import { notify } from '@/Lib/notify';
import { extractApiErrorMessage } from '@/Lib/apiError';
import { getDeviceId } from '@/Lib/deviceId';
import type { PromiseVotes } from './types';

const storageKey = (n: number) => `promise-vote:${n}`;

/**
 * Tallies returned by this visitor's own votes, kept for the session. Going
 * Back to the list restores the page props from history, which predate the
 * vote; the card would then show the visitor's answer against a count that
 * leaves it out. Written only from the click handler, so it is never shared
 * between server-rendered requests.
 */
const seen = new Map<number, PromiseVotes>();

/** A promise's total only grows (answers change, they are not withdrawn), so the larger total is the newer one. */
function newest(number: number, fromProps: PromiseVotes): PromiseVotes {
    const mine = seen.get(number);
    return mine && mine.yes + mine.no >= fromProps.yes + fromProps.no ? mine : fromProps;
}

/**
 * The "will it be kept?" vote for one promise, shared by the detail panel and
 * the list cards. The visitor's own answer is remembered in this browser
 * only; the server stores an HMAC, never the device id or IP, and returns
 * the aggregate.
 */
export function usePromiseVote(number: number, initial: PromiseVotes) {
    const [votes, setVotes] = useState(() => newest(number, initial));
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
            seen.set(number, res.data.votes);
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
