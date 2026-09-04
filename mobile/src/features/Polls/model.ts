import type {
  PollCandidate,
  PollHistory,
  PollTierKey,
  PollTiers,
} from '@/lib/api/polls';

export const TIER_KEYS: readonly PollTierKey[] = ['S', 'A', 'B', 'C', 'D', 'F'];

export const TIER_LABELS: Readonly<Record<PollTierKey, string>> = {
  S: 'ممتاز',
  A: 'جيد جدًا',
  B: 'جيد',
  C: 'مقبول',
  D: 'ضعيف',
  F: 'سيئ',
};

export interface TierBoardState {
  selected: string[];
  tiers: Record<PollTierKey, string[]>;
}

export type ChartMetric = 'score' | 'votes';
export type ChartTimeframe = 'day' | 'week' | 'month' | 'year';
export type ChartView = 'cumulative' | 'periodic';

interface ChartOptions {
  metric: ChartMetric;
  timeframe: ChartTimeframe;
  view: ChartView;
}

export interface PollChartSeries {
  labels: string[];
  series: { candidateId: string; name: string; points: number[] }[];
}

function xmur3(value: string): () => number {
  let hash = 1_779_033_703 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3_432_918_353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_507);
    hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createEmptyBoard(): TierBoardState {
  return {
    selected: [],
    tiers: { S: [], A: [], B: [], C: [], D: [], F: [] },
  };
}

export function defaultGroupId(
  groups: readonly { id: string; isDefault: boolean }[],
): string | null {
  return groups.find(({ isDefault }) => isDefault)?.id ?? groups[0]?.id ?? null;
}

export function candidatesForGroup(
  candidates: readonly PollCandidate[],
  groupId: string | null,
  legacyCategory?: string | null,
): PollCandidate[] {
  if (!groupId) {
    return [...candidates];
  }
  return candidates.filter(
    (candidate) =>
      candidate.groupId === groupId
      || (!candidate.groupId && Boolean(legacyCategory) && candidate.category === legacyCategory),
  );
}

export function deterministicCandidateOrder(
  candidates: readonly PollCandidate[],
  pollId: string,
  voteDay: string,
): PollCandidate[] {
  const random = mulberry32(xmur3(`${pollId}|${voteDay}`)());
  const shuffled = [...candidates];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled;
}

export function toggleBoardSelection(
  board: TierBoardState,
  candidateId: string,
): TierBoardState {
  const selected = board.selected.includes(candidateId)
    ? board.selected.filter((id) => id !== candidateId)
    : [...board.selected, candidateId];
  return { ...board, selected };
}

function tiersWithout(
  tiers: Readonly<Record<PollTierKey, string[]>>,
  removed: ReadonlySet<string>,
): Record<PollTierKey, string[]> {
  return Object.fromEntries(
    TIER_KEYS.map((key) => [key, tiers[key].filter((id) => !removed.has(id))]),
  ) as Record<PollTierKey, string[]>;
}

export function moveCandidatesToTier(
  board: TierBoardState,
  targetTier: PollTierKey,
  candidateOrder: readonly PollCandidate[],
): TierBoardState {
  const selected = new Set(board.selected);
  if (selected.size === 0) {
    return board;
  }
  const ordered = candidateOrder
    .map(({ id }) => id)
    .filter((id) => selected.has(id));
  const tiers = tiersWithout(board.tiers, selected);
  tiers[targetTier] = [...tiers[targetTier], ...ordered];
  return { selected: [], tiers };
}

// Without this a placed candidate can only leave a tier by resetting the whole board.
export function returnCandidatesToBank(board: TierBoardState): TierBoardState {
  const selected = new Set(board.selected);
  if (selected.size === 0) {
    return board;
  }
  return { selected: [], tiers: tiersWithout(board.tiers, selected) };
}

export function moveCandidateWithinTier(
  board: TierBoardState,
  tier: PollTierKey,
  candidateId: string,
  direction: -1 | 1,
): TierBoardState {
  const items = [...board.tiers[tier]];
  const from = items.indexOf(candidateId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= items.length) {
    return board;
  }
  [items[from], items[to]] = [items[to]!, items[from]!];
  return { ...board, tiers: { ...board.tiers, [tier]: items } };
}

export function switchCandidateGroup(_board: TierBoardState): TierBoardState {
  return createEmptyBoard();
}

export function assignedCandidateCount(board: TierBoardState): number {
  return TIER_KEYS.reduce((count, key) => count + board.tiers[key].length, 0);
}

export function validateBoard(
  board: TierBoardState,
  minimumSelections: number,
): string | null {
  return assignedCandidateCount(board) < minimumSelections
    ? `اختر ${minimumSelections} مرشحين على الأقل قبل التصويت.`
    : null;
}

export function serializeBoard(board: TierBoardState): PollTiers {
  return Object.fromEntries(
    TIER_KEYS.map((key) => [
      key,
      board.tiers[key].map((candidateId, pos) => ({ candidateId, pos })),
    ]),
  ) as PollTiers;
}

export function canManagePolls(role: null | string | undefined): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function rankingGroupKey(key: null | string | undefined): string {
  if (key === 'minister') {
    return 'ministers';
  }
  if (key === 'governor') {
    return 'governors';
  }
  if (key === 'secur' || key === 'security') {
    return 'security';
  }
  return key ?? '';
}

export function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${Number((value / 1_000_000).toFixed(1))}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${Number((value / 1_000).toFixed(1))}K`;
  }
  return String(value);
}

function bucketKey(date: string, timeframe: ChartTimeframe): string {
  if (timeframe === 'day') {
    return date;
  }
  if (timeframe === 'month') {
    return date.slice(0, 7);
  }
  if (timeframe === 'year') {
    return date.slice(0, 4);
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() - day + 1);
  return parsed.toISOString().slice(0, 10);
}

export function buildChartSeries(
  history: PollHistory,
  candidates: readonly PollCandidate[],
  options: ChartOptions,
): PollChartSeries {
  const dates = [...new Set(Object.values(history).flatMap((points) =>
    points.map(({ date }) => date),
  ))].sort();
  const labels = [...new Set(dates.map((date) => bucketKey(date, options.timeframe)))];
  const series = candidates.map((candidate) => {
    const values = new Map(
      (history[candidate.id] ?? []).map((point) => [point.date, point[options.metric]]),
    );
    let cumulative = 0;
    const buckets = new Map<string, number>();
    for (const date of dates) {
      const value = values.get(date) ?? 0;
      cumulative += value;
      const key = bucketKey(date, options.timeframe);
      if (options.view === 'cumulative') {
        buckets.set(key, cumulative);
      } else {
        buckets.set(key, (buckets.get(key) ?? 0) + value);
      }
    }
    return {
      candidateId: candidate.id,
      name: candidate.name,
      points: labels.map((label) => buckets.get(label) ?? 0),
    };
  });
  return { labels, series };
}
