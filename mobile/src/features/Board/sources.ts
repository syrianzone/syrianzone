import { z } from 'zod';

import { apiClient } from '@/lib/api/client';

const webUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    !url.username &&
    !url.password
  );
});

const forecastDaySchema = z.object({
  code: z.number().int(),
  date: z.string(),
  max: z.number(),
  min: z.number(),
});

const weatherSchema = z.object({
  description: z.string(),
  forecast: z.array(forecastDaySchema),
  governorate: z.string(),
  icon: z.string(),
  temp: z.number(),
});

const prayerTimesSchema = z.object({
  governorate: z.string(),
  hijri: z
    .object({
      day: z.string(),
      month: z.string(),
      year: z.string(),
    })
    .nullable(),
  timings: z.record(z.string(), z.string()),
});

const answerQuestionSchema = z.object({
  answer_count: z.number().int().nonnegative(),
  created_at: z.number(),
  id: z.union([z.number(), z.string()]).transform(String),
  tags: z.array(z.string()),
  title: z.string(),
  url: webUrlSchema,
});

const answerResponseSchema = z.object({
  items: z.array(answerQuestionSchema),
});

const recipeSchema = z.object({
  city: z.string().nullable(),
  difficulty: z.string().nullable(),
  id: z.number().nullable(),
  image_url: webUrlSchema.nullable(),
  name: z.string(),
  tags: z.array(z.string()),
  time_needed: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ),
  url: webUrlSchema,
});

const recipeResponseSchema = z.object({
  recipe: recipeSchema,
});

const todayEventSchema = z.object({
  address: z.string(),
  category: z.string().nullable(),
  event_date: z.string(),
  event_time: z.string().nullable(),
  id: z.union([z.number(), z.string()]).transform(String),
  is_free: z.boolean(),
  is_online: z.boolean(),
  name: z.string(),
  organizer: z.string().nullable(),
  ticket_price: z.number().nullable(),
  url: webUrlSchema,
});

const todayEventsSchema = z.object({
  events: z.array(todayEventSchema),
  governorate: z.string(),
  is_fallback: z.boolean(),
});

const feedSchema = z.object({
  items: z.array(
    z.object({
      link: webUrlSchema.nullable(),
      published_at: z.string().nullable(),
      title: z.string(),
    }),
  ),
  source: z.string(),
  title: z.string(),
});

export type AnswerQuestion = z.infer<typeof answerQuestionSchema>;
export type BoardFeed = z.infer<typeof feedSchema>;
export type BoardPrayerTimes = z.infer<typeof prayerTimesSchema>;
export type BoardRecipe = z.infer<typeof recipeSchema>;
export type BoardTodayEvents = z.infer<typeof todayEventsSchema>;
export type BoardWeather = z.infer<typeof weatherSchema>;

export const boardSources = {
  answers: async (limit: number): Promise<AnswerQuestion[]> => {
    const response = await apiClient.request('/api/answers', {
      auth: false,
      query: { limit },
      schema: answerResponseSchema,
    });
    return response.items;
  },

  eventsToday: (governorate: string): Promise<BoardTodayEvents> =>
    apiClient.request('/api/events/today', {
      auth: false,
      query: { governorate },
      schema: todayEventsSchema,
    }),

  feed: (source: string): Promise<BoardFeed> =>
    apiClient.request('/api/feed', {
      auth: false,
      query: { source },
      schema: feedSchema,
    }),

  prayerTimes: (governorate: string): Promise<BoardPrayerTimes> =>
    apiClient.request('/api/prayer-times', {
      auth: false,
      query: { governorate },
      schema: prayerTimesSchema,
    }),

  recipeOfTheDay: async (): Promise<BoardRecipe> => {
    const response = await apiClient.request('/api/recipe-of-the-day', {
      auth: false,
      schema: recipeResponseSchema,
    });
    return response.recipe;
  },

  weather: (governorate: string): Promise<BoardWeather> =>
    apiClient.request('/api/weather', {
      auth: false,
      query: { governorate },
      schema: weatherSchema,
    }),
};

/*
PORT STATUS
  source:     resources/js/Pages/Board/_lib/sources.ts (144 lines)
  confidence: high
  todos:      0
  notes:      Typed native source adapters preserve all public widget data requests and response validation.
*/
