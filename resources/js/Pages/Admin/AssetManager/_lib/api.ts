import { api as client, API_V1 } from '@/Lib/api';

/**
 * The hosted-file endpoints the asset manager calls: one page listing (paged by
 * cursor), an upload and a delete. The paths and the wire shapes live here so
 * the page never spells an API URL (`routes/web.php` owns the group).
 */

export interface R2File {
  path: string;
  filename: string;
  folder: string;
  size: number;
  last_modified: number | null;
  url: string;
}

/** The list answer: one cursor page of files plus the running totals. */
interface AssetListResponse {
  success: boolean;
  files: R2File[];
  total_size: number;
  next_cursor?: string | null;
  has_more?: boolean;
}

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
}

const base = `${API_V1}/admin/assets`;

export const assetsApi = {
  list(params: { refresh?: 0 | 1; cursor?: string }): Promise<AssetListResponse> {
    return client.get(`${base}/list`, { params });
  },

  upload(file: File, folder: string): Promise<UploadResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    return client.post(`${base}/upload`, form);
  },

  remove(path: string): Promise<unknown> {
    return client.delete(`${base}/delete`, { path });
  },
};
