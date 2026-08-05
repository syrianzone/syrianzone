import axios from '@/Lib/axios';
import type { BoardDoc } from './types';

const base = '/api/v1';

export const api = {
  async getBoard(): Promise<{ document: unknown; updated_at: string | null }> {
    const { data } = await axios.get(`${base}/board`);
    return data;
  },

  async putBoard(document: BoardDoc): Promise<{ updated_at: string }> {
    const { data } = await axios.put(`${base}/board`, { document });
    return data;
  },
};
