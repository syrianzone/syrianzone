import { z } from 'zod';

import { apiClient } from '@/lib/api/client';
import { normalizeSearchTemplate } from '@/lib/ported/home';

const boundedText = z.string().trim().min(1).max(80);
const isWebUrl = (value: string) => {
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

const featureLinkSchema = z
  .object({
    id: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
    label_ar: boundedText,
    label_en: boundedText,
    target: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
    type: z.literal('feature'),
  })
  .strict();

const externalLinkSchema = z
  .object({
    id: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
    label_ar: boundedText,
    label_en: boundedText,
    target: z.string().trim().max(2048).refine(isWebUrl),
    type: z.literal('external'),
  })
  .strict();

export const homeQuickLinkSchema = z.discriminatedUnion('type', [
  featureLinkSchema,
  externalLinkSchema,
]);

export const homeSearchProviderSchema = z
  .object({
    id: z.enum(['duckduckgo', 'searx', 'google', 'bing']),
    label: boundedText,
    template: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (value) =>
          value.includes('%s') && normalizeSearchTemplate(value) !== null,
      ),
  })
  .strict();

export const homeContentResponseSchema = z
  .object({
    data: z
      .object({
        about_content: z.string().max(100_000),
        quick_links: z.array(homeQuickLinkSchema).max(30),
        search_providers: z.array(homeSearchProviderSchema).max(8),
      })
      .strict(),
  })
  .strict();

export type HomeContent = z.infer<typeof homeContentResponseSchema>['data'];
export type HomeQuickLink = z.infer<typeof homeQuickLinkSchema>;

export async function fetchHomeContent(
  signal?: AbortSignal,
): Promise<HomeContent> {
  const response = await apiClient.request('/api/mobile/home', {
    auth: false,
    schema: homeContentResponseSchema,
    signal,
  });
  return response.data;
}

/*
PORT STATUS
  source:     resources/js/Pages/Home.tsx (1722 lines)
  confidence: high
  todos:      0
  notes:      The native start page validates links and search providers at the API boundary.
*/
