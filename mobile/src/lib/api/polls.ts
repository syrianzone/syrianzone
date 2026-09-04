import { z } from 'zod';

import { getInstallationId } from '@/lib/storage/secure';

import { apiClient } from './client';
import { ApiError } from './errors';
import {
  legacyLeaderboardSchema,
  legacyLeaderboardToMobile,
  legacyPollDetailSchema,
  legacyPollDetailToMobile,
  legacyPollListSchema,
  legacyPollToMobile,
  legacyVoteError,
  legacyVoteResponseSchema,
} from './pollsLegacy';
import { envelopeSchema } from './schemas';

const nullableText = z.string().nullable();

export const pollSummarySchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
  slug: z.string().min(1),
  timezone: z.string().min(1),
  title: z.string().min(1),
});

export const pollGroupSchema = z.object({
  id: z.string().min(1),
  isDefault: z.boolean(),
  key: nullableText,
  name: z.string().min(1),
  pollId: z.string().min(1),
  sortOrder: z.number().int(),
});

export const pollCandidateSchema = z.object({
  archiveReason: nullableText,
  category: z.string().min(1),
  groupId: nullableText,
  id: z.string().min(1),
  imageUrl: nullableText,
  name: z.string().min(1),
  status: z.enum(['active', 'archived']),
  successorId: nullableText,
  termEndedAt: nullableText,
  termStartedAt: nullableText,
  title: nullableText,
});

export const pollScoreSchema = z.object({
  candidateId: z.string().min(1),
  day: z.string().min(1),
  score: z.number().int(),
  votes: z.number().int().nonnegative(),
});

export const pollDetailSchema = z.object({
  candidates: z.array(pollCandidateSchema),
  groups: z.array(pollGroupSchema),
  poll: pollSummarySchema,
  todayScores: z.array(pollScoreSchema),
  voteDay: z.string().min(1),
});

export const pollRankingSchema = z.object({
  archiveReason: nullableText,
  avg: z.number(),
  candidateId: z.string().min(1),
  category: nullableText,
  groupId: nullableText,
  imageUrl: nullableText,
  name: z.string(),
  rank: z.number().int().positive(),
  score: z.number().int(),
  status: z.enum(['active', 'archived']),
  successorId: nullableText,
  termEndedAt: nullableText,
  termStartedAt: nullableText,
  title: nullableText,
  votes: z.number().int().nonnegative(),
});

export const pollHistoryPointSchema = z.object({
  date: z.string().min(1),
  score: z.number().int(),
  votes: z.number().int().nonnegative(),
});

export const pollLeaderboardSchema = z.object({
  groups: z.array(pollGroupSchema),
  history: z.record(z.string(), z.array(pollHistoryPointSchema)),
  historyDays: z.number().int().min(7).max(730),
  poll: pollSummarySchema,
  rankings: z.record(z.string(), z.array(pollRankingSchema)),
  status: z.enum(['active', 'former', 'all']),
});

const pollsResponseSchema = envelopeSchema(z.array(pollSummarySchema));
const pollDetailResponseSchema = envelopeSchema(pollDetailSchema);
const pollLeaderboardResponseSchema = envelopeSchema(pollLeaderboardSchema);
const pollVoteResponseSchema = envelopeSchema(
  z.object({
    accepted: z.literal(true),
    voteDay: z.string().min(1),
  }),
);

export type PollSummary = z.infer<typeof pollSummarySchema>;
export type PollGroup = z.infer<typeof pollGroupSchema>;
export type PollCandidate = z.infer<typeof pollCandidateSchema>;
export type PollDetail = z.infer<typeof pollDetailSchema>;
export type PollRanking = z.infer<typeof pollRankingSchema>;
export type PollHistoryPoint = z.infer<typeof pollHistoryPointSchema>;
export type PollHistory = Record<string, PollHistoryPoint[]>;
export type PollLeaderboard = z.infer<typeof pollLeaderboardSchema>;
export type PollStatus = PollLeaderboard['status'];
export type PollTierKey = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export interface PollTierItem {
  candidateId: string;
  pos: number;
}
export type PollTiers = Record<PollTierKey, PollTierItem[]>;

interface RequestOptions {
  signal?: AbortSignal;
}

interface LeaderboardOptions extends RequestOptions {
  historyDays?: number;
  status?: PollStatus;
}

interface VoteOptions extends RequestOptions {
  installationId?: string;
}

function pollPath(identifier: string): string {
  return encodeURIComponent(identifier);
}

// Production syrian.zone has no /api/mobile routes yet, so a 404 (or a phone that
// cannot reach the server at all) means the request must be replayed against the
// poll API the website has always served. Any other failure is the server talking.
function shouldFallBack(error: unknown): boolean {
  return (
    error instanceof ApiError
    && (error.status === 404 || error.code === 'network')
  );
}

export const pollQueryKeys = {
  admin: ['polls', 'admin'] as const,
  all: ['polls'] as const,
  detail: (identifier: string) => ['polls', 'detail', identifier] as const,
  leaderboard: (identifier: string, status: PollStatus) =>
    ['polls', 'leaderboard', identifier, status] as const,
};

export async function fetchPolls({
  signal,
}: RequestOptions = {}): Promise<PollSummary[]> {
  try {
    const response = await apiClient.request('/api/mobile/polls', {
      auth: false,
      schema: pollsResponseSchema,
      signal,
    });
    return response.data;
  } catch (error) {
    if (!shouldFallBack(error)) {
      throw error;
    }
  }
  // The legacy list is raw rows for the active polls, which today means only
  // best-ministers: the government tier list is the single public poll on the site.
  const polls = await apiClient.request('/api/polls', {
    auth: false,
    schema: legacyPollListSchema,
    signal,
  });
  return polls.map(legacyPollToMobile);
}

export async function fetchAdminPolls({
  signal,
}: RequestOptions = {}): Promise<PollSummary[]> {
  const response = await apiClient.request('/api/mobile/admin/polls', {
    auth: true,
    schema: pollsResponseSchema,
    signal,
  });
  return response.data;
}

export async function fetchPoll(
  identifier: string,
  { signal }: RequestOptions = {},
): Promise<PollDetail> {
  try {
    const response = await apiClient.request(
      `/api/mobile/polls/${pollPath(identifier)}`,
      {
        auth: false,
        schema: pollDetailResponseSchema,
        signal,
      },
    );
    return response.data;
  } catch (error) {
    if (!shouldFallBack(error)) {
      throw error;
    }
  }
  const legacy = await apiClient.request(`/api/polls/${pollPath(identifier)}`, {
    auth: false,
    schema: legacyPollDetailSchema,
    signal,
  });
  return legacyPollDetailToMobile(legacy);
}

export async function fetchPollLeaderboard(
  identifier: string,
  {
    historyDays = 365,
    signal,
    status = 'active',
  }: LeaderboardOptions = {},
): Promise<PollLeaderboard> {
  try {
    const response = await apiClient.request(
      `/api/mobile/polls/${pollPath(identifier)}/leaderboard`,
      {
        auth: false,
        query: { history_days: historyDays, status },
        schema: pollLeaderboardResponseSchema,
        signal,
      },
    );
    return response.data;
  } catch (error) {
    if (!shouldFallBack(error)) {
      throw error;
    }
  }
  // The legacy leaderboard resolves the poll by slug only and always returns the
  // whole history, so the requested window is applied while adapting.
  const legacy = await apiClient.request(
    `/api/polls/${pollPath(identifier)}/leaderboard`,
    {
      auth: false,
      query: { status },
      schema: legacyLeaderboardSchema,
      signal,
    },
  );
  return legacyLeaderboardToMobile(legacy, { historyDays });
}

export async function submitPollVote(
  identifier: string,
  tiers: PollTiers,
  { installationId, signal }: VoteOptions = {},
): Promise<{ accepted: true; voteDay: string }> {
  const deviceId = installationId ?? (await getInstallationId());
  try {
    const response = await apiClient.request(
      `/api/mobile/polls/${pollPath(identifier)}/votes`,
      {
        auth: false,
        body: { installationId: deviceId, tiers },
        method: 'POST',
        schema: pollVoteResponseSchema,
        signal,
      },
    );
    return response.data;
  } catch (error) {
    if (!shouldFallBack(error)) {
      throw error;
    }
  }
  // The legacy ballot takes the same tiers under a slug and the installation id as
  // its device id, and answers {ok: true} with no vote day of its own.
  try {
    await apiClient.request('/api/submit', {
      auth: false,
      body: { deviceId, pollSlug: identifier, tiers },
      method: 'POST',
      schema: legacyVoteResponseSchema,
      signal,
    });
  } catch (error) {
    throw legacyVoteError(error);
  }
  return { accepted: true, voteDay: new Date().toISOString().slice(0, 10) };
}
