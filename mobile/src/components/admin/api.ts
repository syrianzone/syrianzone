import { z } from 'zod';

import { apiClient } from '@/lib/api/client';
import { uploadImage } from '@/lib/api/uploads';
import {
  pollCandidateSchema,
  pollGroupSchema,
  pollSummarySchema,
} from '@/lib/api/polls';
import { envelopeSchema } from '@/lib/api/schemas';

export const adminPollCatalogItemSchema = pollSummarySchema.extend({
  candidatesCount: z.number().int().nonnegative(),
});

export const adminPollDetailSchema = z.object({
  candidates: z.array(pollCandidateSchema),
  groups: z.array(pollGroupSchema),
  poll: pollSummarySchema,
});

const adminPollCatalogResponseSchema = envelopeSchema(
  z.array(adminPollCatalogItemSchema),
);
const adminPollDetailResponseSchema = envelopeSchema(adminPollDetailSchema);
const pollResponseSchema = envelopeSchema(pollSummarySchema);
const groupResponseSchema = envelopeSchema(pollGroupSchema);
const candidateResponseSchema = envelopeSchema(pollCandidateSchema);
const deleteResponseSchema = envelopeSchema(z.object({ deleted: z.literal(true) }));
const reorderResponseSchema = envelopeSchema(
  z.object({ groups: z.array(pollGroupSchema) }),
);

export type AdminPollCatalogItem = z.infer<
  typeof adminPollCatalogItemSchema
>;
export type AdminPollDetail = z.infer<typeof adminPollDetailSchema>;
export type AdminCandidate = z.infer<typeof pollCandidateSchema>;
export type AdminGroup = z.infer<typeof pollGroupSchema>;

export interface PollInput {
  isActive: boolean;
  slug: string;
  timezone: string;
  title: string;
}

export interface CandidateInput {
  groupId: string | null;
  imageUrl: string | null;
  name: string;
  pollId?: string;
  title: string | null;
}

export interface ArchiveCandidateInput {
  archiveReason: string | null;
  successorId: string | null;
  termEndedAt: string | null;
}

function identifier(value: string): string {
  return encodeURIComponent(value);
}

export async function fetchAdminPollCatalog(
  signal?: AbortSignal,
): Promise<AdminPollCatalogItem[]> {
  const response = await apiClient.request('/api/mobile/admin/polls', {
    auth: true,
    schema: adminPollCatalogResponseSchema,
    signal,
  });
  return response.data;
}

export async function fetchAdminPollDetail(
  id: string,
  signal?: AbortSignal,
): Promise<AdminPollDetail> {
  const response = await apiClient.request(
    `/api/mobile/admin/polls/${identifier(id)}`,
    {
      auth: true,
      schema: adminPollDetailResponseSchema,
      signal,
    },
  );
  return response.data;
}

export async function createAdminPoll(input: PollInput) {
  const response = await apiClient.request('/api/mobile/admin/polls', {
    auth: true,
    body: input,
    method: 'POST',
    schema: pollResponseSchema,
  });
  return response.data;
}

export async function updateAdminPoll(id: string, input: PollInput) {
  const response = await apiClient.request(
    `/api/mobile/admin/polls/${identifier(id)}`,
    {
      auth: true,
      body: input,
      method: 'PUT',
      schema: pollResponseSchema,
    },
  );
  return response.data;
}

export async function deleteAdminPoll(id: string): Promise<void> {
  await apiClient.request(`/api/mobile/admin/polls/${identifier(id)}`, {
    auth: true,
    method: 'DELETE',
    schema: deleteResponseSchema,
  });
}

export async function createAdminGroup(pollId: string, name: string) {
  const response = await apiClient.request(
    '/api/mobile/admin/candidate-groups',
    {
      auth: true,
      body: { name, pollId },
      method: 'POST',
      schema: groupResponseSchema,
    },
  );
  return response.data;
}

export async function updateAdminGroup(id: string, name: string) {
  const response = await apiClient.request(
    `/api/mobile/admin/candidate-groups/${identifier(id)}`,
    {
      auth: true,
      body: { name },
      method: 'PUT',
      schema: groupResponseSchema,
    },
  );
  return response.data;
}

export async function deleteAdminGroup(id: string): Promise<void> {
  await apiClient.request(
    `/api/mobile/admin/candidate-groups/${identifier(id)}`,
    {
      auth: true,
      method: 'DELETE',
      schema: deleteResponseSchema,
    },
  );
}

export async function reorderAdminGroups(
  groups: readonly AdminGroup[],
): Promise<AdminGroup[]> {
  const response = await apiClient.request(
    '/api/mobile/admin/candidate-groups/reorder',
    {
      auth: true,
      body: {
        groups: groups.map((group) => ({
          id: group.id,
          sortOrder: group.sortOrder,
        })),
      },
      method: 'POST',
      schema: reorderResponseSchema,
    },
  );
  return response.data.groups;
}

export async function setDefaultAdminGroup(id: string) {
  const response = await apiClient.request(
    `/api/mobile/admin/candidate-groups/${identifier(id)}/default`,
    {
      auth: true,
      method: 'POST',
      schema: groupResponseSchema,
    },
  );
  return response.data;
}

export async function createAdminCandidate(input: CandidateInput) {
  const response = await apiClient.request('/api/mobile/admin/candidates', {
    auth: true,
    body: input,
    method: 'POST',
    schema: candidateResponseSchema,
  });
  return response.data;
}

export async function updateAdminCandidate(
  id: string,
  input: CandidateInput,
) {
  const response = await apiClient.request(
    `/api/mobile/admin/candidates/${identifier(id)}`,
    {
      auth: true,
      body: input,
      method: 'PUT',
      schema: candidateResponseSchema,
    },
  );
  return response.data;
}

export async function deleteAdminCandidate(id: string): Promise<void> {
  await apiClient.request(`/api/mobile/admin/candidates/${identifier(id)}`, {
    auth: true,
    method: 'DELETE',
    schema: deleteResponseSchema,
  });
}

export async function archiveAdminCandidate(
  id: string,
  input: ArchiveCandidateInput,
) {
  const response = await apiClient.request(
    `/api/mobile/admin/candidates/${identifier(id)}/archive`,
    {
      auth: true,
      body: input,
      method: 'PATCH',
      schema: candidateResponseSchema,
    },
  );
  return response.data;
}

export async function restoreAdminCandidate(id: string) {
  const response = await apiClient.request(
    `/api/mobile/admin/candidates/${identifier(id)}/restore`,
    {
      auth: true,
      method: 'PATCH',
      schema: candidateResponseSchema,
    },
  );
  return response.data;
}

export async function uploadAdminCandidateImage(
  uri: string,
  filename = 'candidate-image.jpg',
): Promise<string> {
  return uploadImage(uri, filename);
}
