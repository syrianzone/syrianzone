import { api, API_V1 } from '@/Lib/api';
import type { FakeNewsStats } from './types';

export interface FakeNewsMutationResponse {
  ok: boolean;
  stats: FakeNewsStats;
}

export function fetchFakeNewsStats(signal?: AbortSignal): Promise<FakeNewsStats> {
  return api.get<FakeNewsStats>(`${API_V1}/fakenews/stats`, { signal });
}

export function recordFakeNewsAnswer(
  claimId: string,
  answer: boolean,
): Promise<FakeNewsMutationResponse> {
  return api.post<FakeNewsMutationResponse>(`${API_V1}/fakenews/answer`, {
    claim_id: claimId,
    answer,
  });
}

export function recordFakeNewsResult(score: number): Promise<FakeNewsMutationResponse> {
  return api.post<FakeNewsMutationResponse>(`${API_V1}/fakenews/result`, {
    score,
  });
}
