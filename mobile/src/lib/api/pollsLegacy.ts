/**
 * Adapters for the poll API production syrian.zone actually serves today:
 * /api/polls, /api/polls/{slug}, /api/polls/{slug}/leaderboard and /api/submit.
 * Those routes answer with snake_case database rows, so polls.ts parses them with
 * the schemas below and maps them onto the mobile types when /api/mobile/polls is
 * missing. Screens keep consuming PollDetail and PollLeaderboard and never learn
 * which route answered.
 */
import { z } from 'zod';

import { rankingGroupKey } from '@/features/Polls/model';

import { ApiError } from './errors';
import type {
  PollCandidate,
  PollDetail,
  PollGroup,
  PollHistory,
  PollHistoryPoint,
  PollLeaderboard,
  PollRanking,
  PollSummary,
} from './polls';

const nullableText = z.string().nullable();
// Raw rows carry the MySQL tinyint, cast models carry a real boolean.
const legacyBoolean = z.union([z.boolean(), z.number().int()]);

const legacyPollSchema = z.object({
  id: z.string().min(1),
  is_active: legacyBoolean,
  slug: z.string().min(1),
  timezone: nullableText.optional(),
  title: z.string().min(1),
});

const legacyGroupSchema = z.object({
  id: z.string().min(1),
  is_default: legacyBoolean,
  key: nullableText.optional(),
  name: z.string().min(1),
  poll_id: z.string().min(1),
  sort_order: z.number().int(),
});

const legacyCandidateSchema = z.object({
  archive_reason: nullableText.optional(),
  candidate_group_id: nullableText.optional(),
  category: z.string().min(1),
  id: z.string().min(1),
  image_url: nullableText.optional(),
  name: z.string().min(1),
  status: z.enum(['active', 'archived']).nullable().optional(),
  successor_id: nullableText.optional(),
  term_ended_at: nullableText.optional(),
  term_started_at: nullableText.optional(),
  title: nullableText.optional(),
});

const legacyScoreSchema = z.object({
  candidate_id: z.string().min(1),
  day: z.string().min(1),
  score: z.number().int(),
  votes: z.number().int().nonnegative(),
});

const legacyRankingSchema = z.object({
  archiveReason: nullableText.optional(),
  avg: z.number(),
  candidateId: z.string().min(1),
  category: nullableText.optional(),
  groupId: nullableText.optional(),
  imageUrl: nullableText.optional(),
  name: z.string(),
  rank: z.number().int().positive(),
  score: z.number().int(),
  status: z.enum(['active', 'archived']).nullable().optional(),
  successorId: nullableText.optional(),
  termEndedAt: nullableText.optional(),
  termStartedAt: nullableText.optional(),
  title: nullableText.optional(),
  votes: z.number().int().nonnegative(),
});

const legacyRankingListSchema = z.array(legacyRankingSchema);

const legacyHistoryPointSchema = z.object({
  date: z.string().min(1),
  score: z.number().int(),
  votes: z.number().int().nonnegative(),
});

export const legacyPollListSchema = z.array(legacyPollSchema);

export const legacyPollDetailSchema = z.object({
  candidates: z.array(legacyCandidateSchema),
  groups: z.array(legacyGroupSchema),
  poll: legacyPollSchema,
  todayScores: z.array(legacyScoreSchema),
  voteDay: z.string().min(1),
});

// The rankings hang off the response under one key per group ("ministers",
// "governors", "security", ...), so they are validated per group in the adapter
// and the response itself only declares the keys that are always there.
export const legacyLeaderboardSchema = z
  .object({
    groups: z.array(legacyGroupSchema),
    history: z.record(z.string(), z.array(legacyHistoryPointSchema)),
    poll: legacyPollSchema,
    status: z.enum(['active', 'former', 'all']),
  })
  .catchall(z.unknown());

export const legacyVoteResponseSchema = z.object({ ok: z.literal(true) });

export type LegacyPoll = z.infer<typeof legacyPollSchema>;
export type LegacyPollDetail = z.infer<typeof legacyPollDetailSchema>;
export type LegacyLeaderboard = z.infer<typeof legacyLeaderboardSchema>;

export interface LegacyLeaderboardOptions {
  historyDays: number;
  now?: Date;
}

// Legacy rows hand back raw database timestamps ("2026-05-09T00:00:00.000000Z",
// "2025-12-17 21:00:00"). The mobile API sends plain calendar days and the chart
// parses them as YYYY-MM-DD, so every date crosses over as its first ten letters.
function toDay(value: string): string {
  return value.slice(0, 10);
}

function toOptionalDay(value: null | string | undefined): null | string {
  return value ? toDay(value) : null;
}

export function legacyPollToMobile(poll: LegacyPoll): PollSummary {
  return {
    id: poll.id,
    isActive: Boolean(poll.is_active),
    slug: poll.slug,
    // A poll saved without a timezone is treated as UTC by the server too.
    timezone: poll.timezone || 'UTC',
    title: poll.title,
  };
}

function toGroup(group: z.infer<typeof legacyGroupSchema>): PollGroup {
  return {
    id: group.id,
    isDefault: Boolean(group.is_default),
    key: group.key ?? null,
    name: group.name,
    pollId: group.poll_id,
    sortOrder: group.sort_order,
  };
}

function toCandidate(
  candidate: z.infer<typeof legacyCandidateSchema>,
): PollCandidate {
  return {
    archiveReason: candidate.archive_reason ?? null,
    category: candidate.category,
    groupId: candidate.candidate_group_id ?? null,
    id: candidate.id,
    imageUrl: candidate.image_url ?? null,
    name: candidate.name,
    status: candidate.status ?? 'active',
    successorId: candidate.successor_id ?? null,
    termEndedAt: toOptionalDay(candidate.term_ended_at),
    termStartedAt: toOptionalDay(candidate.term_started_at),
    title: candidate.title ?? null,
  };
}

function toRanking(row: z.infer<typeof legacyRankingSchema>): PollRanking {
  return {
    archiveReason: row.archiveReason ?? null,
    avg: row.avg,
    candidateId: row.candidateId,
    category: row.category ?? null,
    groupId: row.groupId ?? null,
    imageUrl: row.imageUrl ?? null,
    name: row.name,
    rank: row.rank,
    score: row.score,
    status: row.status ?? 'active',
    successorId: row.successorId ?? null,
    termEndedAt: toOptionalDay(row.termEndedAt),
    termStartedAt: toOptionalDay(row.termStartedAt),
    title: row.title ?? null,
    votes: row.votes,
  };
}

function windowStart(now: Date, historyDays: number): string {
  const start = new Date(now.getTime());
  start.setUTCDate(start.getUTCDate() - (historyDays - 1));
  return start.toISOString().slice(0, 10);
}

// The legacy leaderboard ships every day it ever recorded, and two of its rows can
// land on one calendar day because older rows were written at a different offset.
// Days are summed and cut to the window the mobile endpoint would have applied.
function toHistory(
  history: Readonly<Record<string, readonly z.infer<typeof legacyHistoryPointSchema>[]>>,
  historyDays: number,
  now: Date,
): PollHistory {
  const firstDay = windowStart(now, historyDays);
  const entries = Object.entries(history).map(([candidateId, points]) => {
    const byDay = new Map<string, PollHistoryPoint>();
    for (const point of points) {
      const date = toDay(point.date);
      if (date < firstDay) {
        continue;
      }
      const previous = byDay.get(date);
      byDay.set(date, {
        date,
        score: (previous?.score ?? 0) + point.score,
        votes: (previous?.votes ?? 0) + point.votes,
      });
    }
    const merged = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    return [candidateId, merged] as const;
  });
  return Object.fromEntries(entries.filter(([, points]) => points.length > 0));
}

export function legacyPollDetailToMobile(payload: LegacyPollDetail): PollDetail {
  return {
    candidates: payload.candidates.map(toCandidate),
    groups: payload.groups.map(toGroup),
    poll: legacyPollToMobile(payload.poll),
    todayScores: payload.todayScores.map((score) => ({
      candidateId: score.candidate_id,
      day: toDay(score.day),
      score: score.score,
      votes: score.votes,
    })),
    voteDay: toDay(payload.voteDay),
  };
}

export function legacyLeaderboardToMobile(
  payload: LegacyLeaderboard,
  { historyDays, now = new Date() }: LegacyLeaderboardOptions,
): PollLeaderboard {
  const rankings: Record<string, PollRanking[]> = {};
  for (const group of payload.groups) {
    const key = rankingGroupKey(group.key ?? group.id);
    const rows = legacyRankingListSchema.safeParse(payload[key] ?? []);
    if (!rows.success) {
      throw new ApiError(
        502,
        'invalid_response',
        'أعاد الخادم بيانات غير متوقعة.',
      );
    }
    rankings[key] = rows.data.map(toRanking);
  }
  return {
    groups: payload.groups.map(toGroup),
    history: toHistory(payload.history, historyDays, now),
    historyDays,
    poll: legacyPollToMobile(payload.poll),
    rankings,
    status: payload.status,
  };
}

// The legacy stack keeps no per-device receipt, so a repeat ballot is only stopped
// by the /api/submit throttle (ten posts a minute for one address), which answers
// 429. That is the closest thing it has to the mobile duplicate check, so it
// carries the code the board already explains in Arabic; every other failure keeps
// its own code.
export function legacyVoteError(error: unknown): unknown {
  if (error instanceof ApiError && error.status === 429) {
    return new ApiError(
      429,
      'already_voted_today',
      'تم تسجيل تصويت من هذا الجهاز لهذا الاستطلاع اليوم.',
    );
  }
  return error;
}

/*
PORT STATUS
  source:     app/Http/Controllers/PollController.php (show, leaderboard, submit)
  confidence: high
  todos:      0
  notes:      Pure adapters for the pre-mobile poll routes; polls.ts uses them only when /api/mobile/polls is missing.
*/
