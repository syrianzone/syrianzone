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

const STATUS_MESSAGES: Record<number, string> = {
  401: 'سجل الدخول للمتابعة',
  419: 'انتهت الجلسة، أعد تحميل الصفحة',
  422: 'تعذر حفظ اللوحة',
  429: 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة',
};

export function extractError(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { message?: string } } };
  const message = err.response?.data?.message;
  // only trust the app's own Arabic messages; Laravel defaults are English
  if (message && /[؀-ۿ]/.test(message)) return message;
  const status = err.response?.status;
  return (status !== undefined && STATUS_MESSAGES[status]) || 'تعذر الحفظ، سيعاد المحاولة';
}
