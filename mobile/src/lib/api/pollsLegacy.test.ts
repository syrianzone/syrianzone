/**
 * Fixtures under __fixtures__ are trimmed recordings of the live production
 * responses (syrian.zone/api/polls, /api/polls/best-ministers and its
 * leaderboard); every key of every row is kept, only rows were dropped. The
 * archived candidate in the detail fixture comes from the same endpoint with
 * ?include_archived=1, because the day-to-day response only carries active rows.
 */
import leaderboardFixture from './__fixtures__/legacy-leaderboard.json';
import detailFixture from './__fixtures__/legacy-poll-detail.json';
import pollsFixture from './__fixtures__/legacy-polls.json';
import { ApiError } from './errors';
import {
  pollDetailSchema,
  pollLeaderboardSchema,
  pollSummarySchema,
} from './polls';
import {
  legacyLeaderboardSchema,
  legacyLeaderboardToMobile,
  legacyPollDetailSchema,
  legacyPollDetailToMobile,
  legacyPollListSchema,
  legacyPollToMobile,
  legacyVoteError,
} from './pollsLegacy';

const detail = legacyPollDetailSchema.parse(detailFixture);
const leaderboard = legacyLeaderboardSchema.parse(leaderboardFixture);
const ministerGroupId = 'a09f1321-1a4b-49c4-94f9-f49895e97579';
const shaibaniId = 'a09dd121-597d-4e74-bd88-ea2cbf64e5f9';
const mustafaId = 'a09dd121-5a27-4544-bd40-c4a924ac8a78';
const healthMinisterId = 'a09dd121-5ade-4c4a-bff8-3353face1ee9';
const centralBankerId = 'a09dd121-5efd-4dd7-81ca-b88dd84c1c17';
const today = new Date('2026-09-04T12:00:00Z');

describe('legacy poll detail adapter', () => {
  const mapped = legacyPollDetailToMobile(detail);

  test('reads the recorded website response into the mobile poll contract', () => {
    expect(pollDetailSchema.parse(mapped)).toEqual(mapped);
    expect(mapped.poll).toEqual({
      id: 'a09dd121-28bf-46ba-a431-418332e3c6c6',
      isActive: true,
      slug: 'best-ministers',
      timezone: 'Europe/Amsterdam',
      title: 'Best Ministers',
    });
    expect(mapped.groups[0]).toEqual({
      id: 'a09f1321-17d4-42a5-89d7-8891c2c4d6c8',
      isDefault: false,
      key: 'governor',
      name: 'المحافظون',
      pollId: 'a09dd121-28bf-46ba-a431-418332e3c6c6',
      sortOrder: 0,
    });
    expect(mapped.candidates[0]).toEqual({
      archiveReason: null,
      category: 'minister',
      groupId: ministerGroupId,
      id: shaibaniId,
      imageUrl:
        'https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/tierlist/candidates/item1.webp',
      name: 'أسعد حسن الشيباني',
      status: 'active',
      successorId: null,
      termEndedAt: null,
      termStartedAt: null,
      title: 'وزير الخارجية والمغتربين',
    });
  });

  test('turns every stored timestamp into the calendar day the app charts', () => {
    expect(mapped.voteDay).toBe('2026-09-04');
    expect(mapped.todayScores[0]).toEqual({
      candidateId: shaibaniId,
      day: '2026-09-04',
      score: 299,
      votes: 6,
    });
    expect(
      mapped.candidates.find(({ id }) => id === mustafaId)?.termEndedAt,
    ).toBe('2026-05-09');
  });
});

describe('legacy leaderboard adapter', () => {
  const mapped = legacyLeaderboardToMobile(leaderboard, {
    historyDays: 365,
    now: today,
  });

  test('files the rankings under the group keys the screen looks up', () => {
    expect(pollLeaderboardSchema.parse(mapped)).toEqual(mapped);
    expect(Object.keys(mapped.rankings).sort()).toEqual([
      'governors',
      'jolani',
      'ministers',
      'security',
    ]);
    expect(mapped.rankings.ministers?.map(({ rank }) => rank)).toEqual([
      1, 8, 13,
    ]);
    expect(mapped.status).toBe('all');
    expect(mapped.historyDays).toBe(365);
  });

  test('carries the archive details a former minister row needs', () => {
    const former = mapped.rankings.ministers?.find(
      ({ candidateId }) => candidateId === centralBankerId,
    );

    expect(former).toMatchObject({
      archiveReason: null,
      avg: 30.56,
      name: 'عبد القادر حصرية',
      status: 'archived',
      successorId: 'a09dd121-5f6e-4a74-b622-b7850e3cb7d5',
      termEndedAt: '2026-05-15',
      termStartedAt: null,
      votes: 1595,
    });
  });

  test('sums a day the website recorded twice at different offsets', () => {
    const points = mapped.history[healthMinisterId] ?? [];

    expect(points).toContainEqual({
      date: '2025-12-17',
      score: 130,
      votes: 3,
    });
    expect(points.map(({ date }) => date)).toEqual([
      '2025-09-06',
      '2025-09-07',
      '2025-12-17',
      '2026-09-03',
      '2026-09-04',
    ]);
  });

  test('cuts the history to the requested window', () => {
    const short = legacyLeaderboardToMobile(leaderboard, {
      historyDays: 30,
      now: today,
    });

    expect(short.history[healthMinisterId]?.map(({ date }) => date)).toEqual([
      '2026-09-03',
      '2026-09-04',
    ]);
    // The former minister's last day is 2026-05-13, so nothing of his is left.
    expect(short.history[centralBankerId]).toBeUndefined();
  });

  test('refuses a rankings key that is not a list of candidate scores', () => {
    const broken = { ...leaderboard, ministers: [{ rank: 'first' }] };

    expect(() =>
      legacyLeaderboardToMobile(broken, { historyDays: 365, now: today }),
    ).toThrow(
      expect.objectContaining({ code: 'invalid_response', status: 502 }),
    );
  });
});

describe('legacy poll list and vote errors', () => {
  test('maps the single public poll the website lists', () => {
    const polls = legacyPollListSchema.parse(pollsFixture).map(legacyPollToMobile);

    expect(polls).toEqual([
      {
        id: 'a09dd121-28bf-46ba-a431-418332e3c6c6',
        isActive: true,
        slug: 'best-ministers',
        timezone: 'Europe/Amsterdam',
        title: 'Best Ministers',
      },
    ]);
    expect(pollSummarySchema.parse(polls[0])).toEqual(polls[0]);
  });

  test('reports a throttled repeat ballot as a vote already cast today', () => {
    const throttled = legacyVoteError(
      new ApiError(429, 'http_429', 'Too many votes. Please slow down.'),
    );

    expect(throttled).toBeInstanceOf(ApiError);
    expect(throttled).toMatchObject({
      code: 'already_voted_today',
      status: 429,
    });
  });

  test('leaves every other ballot failure with its own code', () => {
    const rejected = new ApiError(400, 'http_400', 'Minimum selection is 3');

    expect(legacyVoteError(rejected)).toBe(rejected);
    expect(legacyVoteError(new Error('offline'))).toBeInstanceOf(Error);
  });
});
