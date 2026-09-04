import { z } from 'zod';

import { apiClient } from '@/lib/api/client';
import { authUserSchema } from '@/lib/auth/types';
import { envelopeSchema } from '@/lib/api/schemas';

// users.role is a free string column, and Filament can already assign six admin
// roles, so a single unrecognized value must not fail the whole list payload.
export const managedUserRoleSchema = z.string().min(1);

// The mobile create route validates Rule::in(['user', 'admin', 'transit_admin']),
// so those are the only roles this app is allowed to send.
export const assignableUserRoleSchema = z.enum([
  'user',
  'transit_admin',
  'admin',
]);

export const managedUserSchema = authUserSchema.extend({
  created_at: z.string().nullable(),
  role: managedUserRoleSchema,
});

const usersResponseSchema = envelopeSchema(z.array(managedUserSchema));
const userResponseSchema = envelopeSchema(managedUserSchema);
export const managedUserBanStateSchema = z.object({
  id: z.number().int().positive(),
  is_banned: z.boolean(),
  name: z.string().min(1),
});
const toggledUserResponseSchema = envelopeSchema(
  z.object({ user: managedUserBanStateSchema }),
);
const deletedResponseSchema = envelopeSchema(
  z.object({ deleted: z.literal(true) }),
);

export type ManagedUser = z.infer<typeof managedUserSchema>;
export type ManagedUserBanState = z.infer<typeof managedUserBanStateSchema>;
export type ManagedUserRole = z.infer<typeof managedUserRoleSchema>;
export type AssignableUserRole = z.infer<typeof assignableUserRoleSchema>;

export interface CreateManagedUserInput {
  email: string;
  name: string;
  role: AssignableUserRole;
}

export async function fetchManagedUsers(
  signal?: AbortSignal,
): Promise<ManagedUser[]> {
  const response = await apiClient.request('/api/mobile/admin/users', {
    auth: true,
    schema: usersResponseSchema,
    signal,
  });
  return response.data;
}

export async function createManagedUser(
  input: CreateManagedUserInput,
): Promise<ManagedUser> {
  const response = await apiClient.request('/api/mobile/admin/users', {
    auth: true,
    body: input,
    method: 'POST',
    schema: userResponseSchema,
  });
  return response.data;
}

export async function deleteManagedUser(id: number): Promise<void> {
  await apiClient.request(`/api/mobile/admin/users/${id}`, {
    auth: true,
    method: 'DELETE',
    schema: deletedResponseSchema,
  });
}

export async function toggleManagedUserBan(
  id: number,
  isBanned: boolean,
): Promise<ManagedUserBanState> {
  const response = await apiClient.request(
    `/api/mobile/admin/users/${id}/toggle-ban`,
    {
      auth: true,
      body: { is_banned: isBanned },
      method: 'POST',
      schema: toggledUserResponseSchema,
    },
  );
  return response.data.user;
}
