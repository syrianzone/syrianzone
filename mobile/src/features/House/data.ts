import { z } from 'zod';

import { apiClient } from '@/lib/api/client';

import type { HouseData, Mode, ProvinceKey } from './types';

export const houseRowSchema = z
  .object({
    Age: z.string(),
    __ageGroup: z.enum(['lt30', '30s', '40s', '50s', '60p']),
    __appealStatus: z.string(),
    __nameNorm: z.string(),
    __placeNorm: z.string(),
    __sexNorm: z.enum(['', 'ذكر', 'أنثى']),
  })
  .catchall(z.string());

export const houseResponseSchema = z.object({
  data: z
    .object({
      headers: z.array(z.string().min(1)),
      rows: z.array(houseRowSchema),
    })
    .strict(),
}).strict();

interface FetchHouseDataOptions {
  mode: Mode;
  province?: ProvinceKey;
  signal?: AbortSignal;
}

export const houseQueryKeys = {
  all: ['house'] as const,
  detail: (mode: Mode, province: ProvinceKey) =>
    ['house', mode, province] as const,
};

export async function fetchHouseData({
  mode,
  province = 'damascus',
  signal,
}: FetchHouseDataOptions): Promise<HouseData> {
  const response = await apiClient.request('/api/mobile/house', {
    auth: false,
    query: { mode, province },
    schema: houseResponseSchema,
    signal,
  });

  return response.data;
}

/*
PORT STATUS
  source:     resources/js/Pages/House/data.ts (165 lines)
  confidence: high
  todos:      0
  notes:      Native clients consume the validated first-party proxy and never fetch Sheets directly.
*/
