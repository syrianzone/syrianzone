import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import {
  fetchHomeContent,
  homeContentResponseSchema,
} from './api';

const validPayload = {
  data: {
    about_content: '# Syrian Zone',
    quick_links: [
      {
        id: 'calendar',
        label_ar: 'الروزنامة',
        label_en: 'Calendar',
        target: 'roznama',
        type: 'feature',
      },
      {
        id: 'joory',
        label_ar: 'جوري',
        label_en: 'Joory',
        target: 'https://joory.chat',
        type: 'external',
      },
    ],
    search_providers: [
      {
        id: 'duckduckgo',
        label: 'DuckDuckGo',
        template: 'https://duckduckgo.com/?q=%s',
      },
    ],
  },
};

describe('home content contract', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('accepts the bounded server payload', () => {
    expect(homeContentResponseSchema.parse(validPayload)).toEqual(validPayload);
  });

  test('rejects executable targets, unknown fields, and oversized collections', () => {
    expect(
      homeContentResponseSchema.safeParse({
        ...validPayload,
        data: {
          ...validPayload.data,
          quick_links: [
            {
              ...validPayload.data.quick_links[1],
              target: 'javascript:alert(1)',
            },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      homeContentResponseSchema.safeParse({
        ...validPayload,
        data: {
          ...validPayload.data,
          quick_links: [
            {
              ...validPayload.data.quick_links[1],
              target: 'https://joory.chat/\npath',
            },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      homeContentResponseSchema.safeParse({
        ...validPayload,
        data: {
          ...validPayload.data,
          quick_links: [
            {
              ...validPayload.data.quick_links[1],
              target: 'mailto:someone@example.com',
            },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      homeContentResponseSchema.safeParse({
        ...validPayload,
        data: { ...validPayload.data, unexpected: true },
      }).success,
    ).toBe(false);
    expect(
      homeContentResponseSchema.safeParse({
        ...validPayload,
        data: {
          ...validPayload.data,
          quick_links: Array.from({ length: 31 }, (_, index) => ({
            ...validPayload.data.quick_links[0],
            id: `link-${index}`,
          })),
        },
      }).success,
    ).toBe(false);
  });

  test('loads the public endpoint without an access token', async () => {
    const request = jest
      .spyOn(apiClient, 'request')
      .mockImplementation(
        async <T>(
          _path: string,
          options: ApiRequestOptions<T>,
        ): Promise<T> => options.schema.parse(validPayload),
      );

    await expect(fetchHomeContent()).resolves.toEqual(validPayload.data);
    expect(request).toHaveBeenCalledWith(
      '/api/mobile/home',
      expect.objectContaining({ auth: false }),
    );
  });
});
