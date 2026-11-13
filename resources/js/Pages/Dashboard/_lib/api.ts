import { api as client, API_ROOT } from '@/Lib/api';

/** The account endpoints the dashboard owns: nothing else edits the profile. */
export const accountApi = {
  uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const form = new FormData();
    form.append('avatar', file);
    return client.post(`${API_ROOT}/account/avatar`, form);
  },

  updateProfile(input: { name: string; email: string }): Promise<unknown> {
    return client.post(`${API_ROOT}/account/update`, input);
  },

  deleteAccount(): Promise<unknown> {
    return client.post(`${API_ROOT}/account/delete`);
  },
};
