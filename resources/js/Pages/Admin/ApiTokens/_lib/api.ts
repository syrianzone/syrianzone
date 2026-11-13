import { api as client, API_V1 } from '@/Lib/api';

/**
 * The agent-token endpoints the admin page calls: mint, single revoke, and the
 * superadmin's "revoke every token of this account". The page owns the row and
 * page-prop shapes; this module owns the paths and the answers.
 */

const base = `${API_V1}/admin/api-tokens`;

export const apiTokensApi = {
  issue(input: { user_id: number; name: string; ttl: string; permissions: string[] }): Promise<{ plain_text_token: string; message: string }> {
    return client.post(base, input);
  },

  revoke(id: number): Promise<{ message: string }> {
    return client.delete(`${base}/${id}`);
  },

  revokeAllForUser(userId: number): Promise<{ message: string }> {
    return client.post(`${base}/revoke-all/${userId}`);
  },
};
