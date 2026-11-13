import { api as client, API_V1 } from '@/Lib/api';
import type { BoardDoc } from './types';

const base = `${API_V1}/board`;

export const api = {
  async getBoard(): Promise<{ document: unknown; updated_at: string | null }> {
    return client.get(base);
  },

  async putBoard(document: BoardDoc, options?: { keepalive?: boolean }): Promise<{ updated_at: string }> {
    return client.put(base, { document }, options);
  },
};
