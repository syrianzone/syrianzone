import type { PromiseVotes } from './model';
interface VoteState { busy: boolean; choice: boolean | null; votes: PromiseVotes | null; error: string | null; needsLogin: boolean }
const empty: Readonly<VoteState> = Object.freeze({ busy: false, choice: null, votes: null, error: null, needsLogin: false });
const states = new Map<string, VoteState>();
const listeners = new Set<() => void>();
let revision = 0;
function publish(key: string, state: VoteState): void { states.set(key, state); revision++; for (const listener of listeners) listener(); }
export const voteRevision = (): number => revision;
export function subscribeVotes(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
export const readVote = (key: string): Readonly<VoteState> => states.get(key) ?? empty;
export function restoreChoice(key: string, choice: boolean | null): void {
  const current = readVote(key); if (current.choice !== null || current.busy || choice === null) return;
  publish(key, { ...current, choice });
}
export function beginVote(key: string): boolean {
  const current = readVote(key); if (current.busy) return false;
  publish(key, { ...current, busy: true, error: null, needsLogin: false }); return true;
}
export function finishVote(key: string, result: Partial<Omit<VoteState, 'busy'>>): void { publish(key, { ...readVote(key), ...result, busy: false }); }

export function promiseVoteKey(userId: number | null, number: number): string {
  const owner = userId === null ? 'guest' : `user-${userId}`;
  return `promise-vote.${owner}.${number}`;
}
