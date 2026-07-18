import { apiClient, type ApiRequestOptions } from './client';
import {
  fetchAdminPolls,
  fetchPoll,
  fetchPollLeaderboard,
  fetchPolls,
  pollDetailSchema,
  pollLeaderboardSchema,
  submitPollVote,
} from './polls';

const poll = {
  id: 'poll-1',
  isActive: true,
  slug: 'best-ministers',
  timezone: 'Asia/Damascus',
  title: 'أفضل الوزراء',
};

const emptyDetail = {
  candidates: [],
  groups: [],
  poll,
  todayScores: [],
  voteDay: '2026-07-15',
};

describe('poll API schemas', () => {
  test('accepts the bounded poll detail and leaderboard contracts', () => {
    expect(pollDetailSchema.parse(emptyDetail)).toEqual(emptyDetail);
    expect(
      pollLeaderboardSchema.parse({
        groups: [],
        history: {},
        historyDays: 365,
        poll,
        rankings: {},
        status: 'active',
      }),
    ).toBeDefined();
  });

  test('rejects malformed vote and history data at the boundary', () => {
    expect(
      pollDetailSchema.safeParse({ ...emptyDetail, candidates: 'all' }).success,
    ).toBe(false);
    expect(
      pollLeaderboardSchema.safeParse({
        groups: [],
        history: { candidate: [{ date: 'today', score: 'high', votes: 1 }] },
        historyDays: 365,
        poll,
        rankings: {},
        status: 'active',
      }).success,
    ).toBe(false);
  });
});

describe('poll API requests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses public mobile endpoints without leaking credentials', async () => {
    const calls: { auth: boolean | undefined; path: string; query?: unknown }[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({ auth: options.auth, path, query: options.query });
        if (path.endsWith('/leaderboard')) {
          return options.schema.parse({
            data: {
              groups: [],
              history: {},
              historyDays: 30,
              poll,
              rankings: {},
              status: 'former',
            },
          });
        }
        if (path === '/api/mobile/polls/best-ministers') {
          return options.schema.parse({ data: emptyDetail });
        }
        return options.schema.parse({ data: [poll] });
      },
    );

    await fetchPolls();
    await fetchPoll('best-ministers');
    await fetchPollLeaderboard('best-ministers', {
      historyDays: 30,
      status: 'former',
    });

    expect(calls).toEqual([
      { auth: false, path: '/api/mobile/polls', query: undefined },
      {
        auth: false,
        path: '/api/mobile/polls/best-ministers',
        query: undefined,
      },
      {
        auth: false,
        path: '/api/mobile/polls/best-ministers/leaderboard',
        query: { history_days: 30, status: 'former' },
      },
    ]);
  });

  test('uses bearer auth only for the administrator listing', async () => {
    const request = jest
      .spyOn(apiClient, 'request')
      .mockImplementation(
        async <T>(_path: string, options: ApiRequestOptions<T>): Promise<T> =>
          options.schema.parse({ data: [poll] }),
      );

    await fetchAdminPolls();

    expect(request).toHaveBeenCalledWith('/api/mobile/admin/polls', {
      auth: true,
      schema: expect.anything(),
      signal: undefined,
    });
  });

  test('submits a stable installation identifier with ordered tiers', async () => {
    const request = jest
      .spyOn(apiClient, 'request')
      .mockImplementation(
        async <T>(_path: string, options: ApiRequestOptions<T>): Promise<T> =>
          options.schema.parse({
            data: { accepted: true, voteDay: '2026-07-15' },
          }),
      );
    const tiers = {
      A: [],
      B: [{ candidateId: 'candidate-2', pos: 0 }],
      C: [],
      D: [],
      F: [],
      S: [{ candidateId: 'candidate-1', pos: 0 }],
    };

    await submitPollVote('best-ministers', tiers, {
      installationId: 'installation-12345678',
    });

    expect(request).toHaveBeenCalledWith(
      '/api/mobile/polls/best-ministers/votes',
      expect.objectContaining({
        auth: false,
        body: { installationId: 'installation-12345678', tiers },
        method: 'POST',
      }),
    );
  });
});
