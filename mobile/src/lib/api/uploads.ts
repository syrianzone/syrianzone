import { z } from 'zod';

import { apiClient } from './client';

const uploadSchema = z.object({ data: z.object({ url: z.string().url() }) });

export async function uploadImage(uri: string, filename = 'image.jpg'): Promise<string> {
  const form = new FormData();
  form.append('image', { name: filename, type: 'image/jpeg', uri } as unknown as Blob);
  const response = await apiClient.request('/api/mobile/admin/uploads', { auth: true, body: form, method: 'POST', schema: uploadSchema });
  return response.data.url;
}

/*
PORT STATUS
  source:     resources/js/Lib/uploadthing.ts (4 lines)
  confidence: high
  todos:      0
  notes:      A role-gated first-party multipart endpoint replaces the browser UploadThing helper.
*/
