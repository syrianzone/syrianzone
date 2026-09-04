import leaderboardFixture from './__fixtures__/legacy-leaderboard.json';
import detailFixture from './__fixtures__/legacy-poll-detail.json';
import pollsFixture from './__fixtures__/legacy-polls.json';
import { apiClient, type ApiRequestOptions } from './client';
import { ApiError } from './errors';
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

/**
 * Production syrian.zone serves no /api/mobile route yet, so these cover the
 * fallback to the website's own poll API. Fixtures are trimmed recordings of the
 * live responses; see pollsLegacy.test.ts.
 */
describe('poll API legacy fallback', () => {
  const notFound = new ApiError(404, 'http_404', 'مسار غير موجود.');
  const offline = new ApiError(0, 'network', 'تعذر الاتصال بالخادم.');

  function serveLegacyRoutes(mobileFailure: ApiError): string[] {
    const paths: string[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        paths.push(path);
        if (path.startsWith('/api/mobile')) {
          throw mobileFailure;
        }
        if (path === '/api/polls') {
          return options.schema.parse(pollsFixture);
        }
        if (path === '/api/polls/best-ministers') {
          return options.schema.parse(detailFixture);
        }
        if (path === '/api/polls/best-ministers/leaderboard') {
          return options.schema.parse(leaderboardFixture);
        }
        if (path === '/api/submit') {
          return options.schema.parse({ ok: true });
        }
        throw new Error(`unexpected request to ${path}`);
      },
    );
    return paths;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('reads the website poll routes when the mobile API is missing', async () => {
    const paths = serveLegacyRoutes(notFound);

    const polls = await fetchPolls();
    const detail = await fetchPoll('best-ministers');
    const leaderboard = await fetchPollLeaderboard('best-ministers', {
      status: 'all',
    });

    expect(polls.map(({ slug }) => slug)).toEqual(['best-ministers']);
    expect(detail.poll.slug).toBe('best-ministers');
    expect(detail.candidates).toHaveLength(5);
    expect(detail.voteDay).toBe('2026-09-04');
    expect(leaderboard.rankings.ministers).toHaveLength(3);
    expect(paths).toEqual([
      '/api/mobile/polls',
      '/api/polls',
      '/api/mobile/polls/best-ministers',
      '/api/polls/best-ministers',
      '/api/mobile/polls/best-ministers/leaderboard',
      '/api/polls/best-ministers/leaderboard',
    ]);
  });

  test('reads them again when the phone cannot reach the server', async () => {
    const paths = serveLegacyRoutes(offline);

    const detail = await fetchPoll('best-ministers');

    expect(detail.candidates[0]?.name).toBe('أسعد حسن الشيباني');
    expect(paths).toEqual([
      '/api/mobile/polls/best-ministers',
      '/api/polls/best-ministers',
    ]);
  });

  test('lets any other server failure through untouched', async () => {
    const failure = new ApiError(500, 'server_error', 'خطأ في الخادم.');
    const paths = serveLegacyRoutes(failure);

    await expect(fetchPoll('best-ministers')).rejects.toBe(failure);
    await expect(fetchPolls()).rejects.toBe(failure);
    expect(paths).toEqual([
      '/api/mobile/polls/best-ministers',
      '/api/mobile/polls',
    ]);
  });

  test('posts the website ballot when the mobile vote route is missing', async () => {
    serveLegacyRoutes(notFound);
    const tiers = {
      A: [],
      B: [{ candidateId: 'candidate-2', pos: 0 }],
      C: [],
      D: [],
      F: [],
      S: [{ candidateId: 'candidate-1', pos: 0 }],
    };

    const receipt = await submitPollVote('best-ministers', tiers, {
      installationId: 'installation-12345678',
    });

    expect(apiClient.request).toHaveBeenLastCalledWith(
      '/api/submit',
      expect.objectContaining({
        auth: false,
        body: {
          deviceId: 'installation-12345678',
          pollSlug: 'best-ministers',
          tiers,
        },
        method: 'POST',
      }),
    );
    expect(receipt.accepted).toBe(true);
    expect(receipt.voteDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('reports a throttled second ballot as a vote already cast today', async () => {
    jest.spyOn(apiClient, 'request').mockImplementation(async (path) => {
      throw path.startsWith('/api/mobile')
        ? notFound
        : new ApiError(429, 'http_429', 'Too many votes. Please slow down.');
    });

    await expect(
      submitPollVote(
        'best-ministers',
        { A: [], B: [], C: [], D: [], F: [], S: [] },
        { installationId: 'installation-12345678' },
      ),
    ).rejects.toMatchObject({ code: 'already_voted_today', status: 429 });
  });
});
