import { z } from 'zod';

import { apiClient } from '@/lib/api/client';
import { envelopeSchema } from '@/lib/api/schemas';

export const contributorSchema = z.object({
  avatar_url: z.string(),
  daily_contributions: z.number().int().nonnegative(),
  monthly_contributions: z.number().int().nonnegative(),
  total_contributions: z.number().int().nonnegative(),
  username: z.string().trim().min(1),
  yearly_contributions: z.number().int().nonnegative(),
});

const contributorsResponseSchema = envelopeSchema(z.array(contributorSchema));

export async function fetchContributors(
  signal?: AbortSignal,
): Promise<z.infer<typeof contributorSchema>[]> {
  const response = await apiClient.request('/api/mobile/contributors', {
    auth: false,
    schema: contributorsResponseSchema,
    signal,
  });
  return response.data;
}
