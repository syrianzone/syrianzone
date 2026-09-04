/**
 * Emergency warnings API. The backend route /api/mobile/warnings normalizes
 * and caches jard's page, but production syrian.zone does not serve
 * /api/mobile/* yet, so on day one the 404 (or a network error) sends every
 * client down the direct fallback: fetch the jard page itself and parse its
 * data-page with the shared model parser. The fallback cannot know about
 * server-side staleness, so it reports stale: false and fetched_at: now.
 * Dependencies are injectable so tests never touch the network or the clock.
 */
import { z } from 'zod';

import { apiClient, type ApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { envelopeSchema } from '@/lib/api/schemas';

import { parseJardPage, warningItemSchema } from './model';

export const JARD_WARNINGS_URL =
  'https://news.jard.chat/?category=warnings&tab=all';

export const warningsQueryKey = ['warnings'] as const;

const warningsPayloadSchema = z.object({
  fetched_at: z.string(),
  items: z.array(warningItemSchema),
  stale: z.boolean(),
});
const warningsResponseSchema = envelopeSchema(warningsPayloadSchema);

export type WarningsPayload = z.infer<typeof warningsPayloadSchema>;

export interface WarningsFetchDependencies {
  client?: ApiClient;
  fetchImplementation?: typeof fetch;
  now?: () => number;
}

function shouldFallBack(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 404 || error.code === 'network')
  );
}

export async function fetchWarningsDirect(
  signal?: AbortSignal,
  deps: WarningsFetchDependencies = {},
): Promise<WarningsPayload> {
  const fetchImplementation = deps.fetchImplementation ?? fetch;
  const response = await fetchImplementation(JARD_WARNINGS_URL, {
    headers: { Accept: 'text/html' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Warnings request failed with status ${response.status}`);
  }
  return {
    fetched_at: new Date(deps.now?.() ?? Date.now()).toISOString(),
    items: parseJardPage(await response.text()),
    stale: false,
  };
}

export async function fetchWarnings(
  signal?: AbortSignal,
  deps: WarningsFetchDependencies = {},
): Promise<WarningsPayload> {
  const client = deps.client ?? apiClient;
  try {
    const response = await client.request('/api/mobile/warnings', {
      auth: false,
      schema: warningsResponseSchema,
      signal,
    });
    return response.data;
  } catch (error) {
    if (!shouldFallBack(error)) {
      throw error;
    }
  }
  return fetchWarningsDirect(signal, deps);
}

/*
PORT STATUS
  source:     none (new native feature)
  confidence: high
  todos:      0
  notes:      Backend first, direct jard fallback on 404 or network failure until /api/mobile ships.
*/
