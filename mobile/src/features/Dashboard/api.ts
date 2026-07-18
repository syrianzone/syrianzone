import { z } from 'zod';

import { apiClient } from '@/lib/api/client';
import { envelopeSchema } from '@/lib/api/schemas';
import { authUserSchema } from '@/lib/auth/types';

export const dashboardDraftSchema = z.object({
  city: z
    .object({
      id: z.string(),
      name_ar: z.string(),
      name_en: z.string(),
    })
    .nullable(),
  city_id: z.string(),
  created_at: z.string().min(1),
  id: z.number().int().positive(),
  name_ar: z.string().min(1),
  name_en: z.string().nullable(),
  notes: z.string().nullable(),
  price: z.number().nullable(),
  rejection_reason: z.string().nullable(),
  status: z.enum(['approved', 'pending', 'rejected']),
  user_id: z.number().int().positive().nullable(),
});

export const dashboardAccountSchema = z.object({
  myDrafts: z.array(dashboardDraftSchema),
  user: authUserSchema,
});

const accountResponseSchema = envelopeSchema(dashboardAccountSchema);
const accountUpdateResponseSchema = envelopeSchema(
  z.object({ user: authUserSchema }),
);
const accountDeleteResponseSchema = envelopeSchema(
  z.object({ deleted: z.literal(true) }),
);

export type DashboardDraft = z.infer<typeof dashboardDraftSchema>;
export type DashboardAccount = z.infer<typeof dashboardAccountSchema>;

export async function fetchDashboardAccount(
  signal?: AbortSignal,
): Promise<DashboardAccount> {
  const response = await apiClient.request('/api/mobile/account', {
    auth: true,
    schema: accountResponseSchema,
    signal,
  });
  return response.data;
}

export async function updateDashboardAccount(input: {
  email: string;
  name: string;
}) {
  const response = await apiClient.request('/api/mobile/account', {
    auth: true,
    body: input,
    method: 'PATCH',
    schema: accountUpdateResponseSchema,
  });
  return response.data.user;
}

export async function deleteDashboardAccount(): Promise<void> {
  await apiClient.request('/api/mobile/account', {
    auth: true,
    method: 'DELETE',
    schema: accountDeleteResponseSchema,
  });
}

export async function withdrawDashboardDraft(id: number): Promise<void> {
  await apiClient.request(`/api/mobile/account/transit-drafts/${id}`, {
    auth: true,
    method: 'DELETE',
    schema: accountDeleteResponseSchema,
  });
}
