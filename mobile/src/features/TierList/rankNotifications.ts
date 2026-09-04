// Rank changes are detected on the device by diffing the live leaderboard against the last snapshot
// this phone saw, so the feature needs no server push infrastructure and no account.
import { z } from 'zod';

import { fetchPollLeaderboard, type PollLeaderboard } from '@/lib/api/polls';
import type {
  NotificationChecker,
  NotificationPayload,
} from '@/lib/notifications/checkers';
import {
  readJsonPreference,
  writeJsonPreference,
} from '@/lib/storage/preferences';

export const rankSnapshotKey = 'sz-tierlist-rank-snapshot';
const governmentPoll = 'best-ministers';
const maxMoversInBody = 3;

const rankEntrySchema = z.object({
  candidateId: z.string(),
  groupKey: z.string(),
  name: z.string(),
  rank: z.number().int(),
  title: z.string().nullable(),
});
const snapshotSchema = z.array(rankEntrySchema);

export type RankEntry = z.infer<typeof rankEntrySchema>;

export interface RankMove {
  candidateId: string;
  from: number;
  label: string;
  to: number;
}

export interface RankCheckerDependencies {
  fetchLeaderboard: (signal?: AbortSignal) => Promise<Pick<PollLeaderboard, 'rankings'>>;
  now: () => number;
}

export function flattenRankings(
  leaderboard: Pick<PollLeaderboard, 'rankings'>,
): RankEntry[] {
  return Object.entries(leaderboard.rankings).flatMap(([groupKey, rows]) =>
    rows.map(({ candidateId, name, rank, title }) => ({
      candidateId,
      groupKey,
      name,
      rank,
      title,
    })),
  );
}

// Only candidates present in both snapshots can move; newcomers and removals shift the others,
// which is what gets reported. Biggest jumps first so the body shows the interesting ones.
export function diffRankSnapshot(
  previous: readonly RankEntry[] | null,
  current: readonly RankEntry[],
): RankMove[] {
  if (!previous) {
    return [];
  }
  const before = new Map(
    previous.map((entry) => [`${entry.groupKey}:${entry.candidateId}`, entry.rank]),
  );
  return current
    .flatMap((entry) => {
      const from = before.get(`${entry.groupKey}:${entry.candidateId}`);
      return from === undefined || from === entry.rank
        ? []
        : [{
          candidateId: entry.candidateId,
          from,
          label: entry.title ?? entry.name,
          to: entry.rank,
        }];
    })
    .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from) || a.to - b.to);
}

// Spelled out rather than an arrow: bidi mirroring flips a lone ← inside Arabic text, which would
// reverse the direction of the move the user reads.
export function formatRankMoves(moves: readonly RankMove[]): string {
  const shown = moves
    .slice(0, maxMoversInBody)
    .map((move) => `${move.label}: من ${move.from} إلى ${move.to}`)
    .join('، ');
  const rest = moves.length - maxMoversInBody;
  if (rest <= 0) {
    return shown;
  }
  return `${shown}، و${rest === 1 ? 'واحد آخر' : `${rest} آخرين`}`;
}

// FNV-1a keeps the dedupe id short and stable across runs.
function hash(value: string): string {
  let state = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    state = Math.imul(state ^ value.charCodeAt(index), 0x01000193);
  }
  return (state >>> 0).toString(36);
}

export function createTierlistRankChecker({
  fetchLeaderboard = (signal) =>
    fetchPollLeaderboard(governmentPoll, { historyDays: 7, signal, status: 'active' }),
  now = Date.now,
}: Partial<RankCheckerDependencies> = {}): NotificationChecker {
  return {
    channelId: 'updates',
    id: 'tierlist-ranks',
    settingKey: 'rankChanges',
    async run(signal): Promise<NotificationPayload[]> {
      const current = flattenRankings(await fetchLeaderboard(signal));
      const previous = await readJsonPreference(rankSnapshotKey, snapshotSchema);
      await writeJsonPreference(rankSnapshotKey, current);
      const moves = diffRankSnapshot(previous, current);
      if (moves.length === 0) {
        return [];
      }
      const day = new Date(now()).toISOString().slice(0, 10);
      const changed = moves.map(({ candidateId }) => candidateId).sort().join(',');
      return [{
        body: formatRankMoves(moves),
        data: { feature: 'tierlist' },
        id: `tierlist-ranks:${day}:${hash(changed)}`,
        title: 'تغيّرت مراكز تير ليست الحكومة',
      }];
    },
  };
}

export const tierlistRankChecker = createTierlistRankChecker();
