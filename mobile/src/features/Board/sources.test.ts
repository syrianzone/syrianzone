import { apiClient } from '@/lib/api/client';

import { boardSources } from './sources';

jest.mock('@/lib/api/client', () => ({
  apiClient: { request: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(apiClient.request).mockResolvedValue({});
});

test.each([
  ['weather', () => boardSources.weather('damascus'), '/api/weather', { governorate: 'damascus' }],
  ['prayer', () => boardSources.prayerTimes('aleppo'), '/api/prayer-times', { governorate: 'aleppo' }],
  ['answers', () => boardSources.answers(8), '/api/answers', { limit: 8 }],
  ['events', () => boardSources.eventsToday('all'), '/api/events/today', { governorate: 'all' }],
  ['feed', () => boardSources.feed('jard'), '/api/feed', { source: 'jard' }],
  ['recipe', () => boardSources.recipeOfTheDay(), '/api/recipe-of-the-day', undefined],
])('reads the public %s widget source through the validated native client', async (
  _name,
  run,
  path,
  query,
) => {
  await run();

  expect(apiClient.request).toHaveBeenCalledWith(path, {
    auth: false,
    ...(query ? { query } : {}),
    schema: expect.anything(),
  });
});

test('normalizes answer and recipe envelopes after validation', async () => {
  jest.mocked(apiClient.request)
    .mockResolvedValueOnce({
      items: [{
        answer_count: 2,
        created_at: 1,
        id: 'q1',
        tags: ['سوريا'],
        title: 'سؤال',
        url: 'https://answers.syrian.zone/questions/1',
      }],
    })
    .mockResolvedValueOnce({
      recipe: {
        city: 'دمشق',
        difficulty: null,
        id: 1,
        image_url: null,
        name: 'فتة',
        tags: [],
        time_needed: [],
        url: 'https://food.syrian.zone/recipes/1',
      },
    });

  await expect(boardSources.answers(8)).resolves.toHaveLength(1);
  await expect(boardSources.recipeOfTheDay()).resolves.toMatchObject({
    name: 'فتة',
  });
});
