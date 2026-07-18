import { apiClient } from '@/lib/api/client';

import type { EnvironmentalReport, PopulationMasterData } from '../types';
import { environmentalReportSchema, populationMasterSchema } from './schemas';

export async function fetchPopulationMaster(signal?: AbortSignal): Promise<PopulationMasterData> {
  return apiClient.request('/api/population/master', {
    auth: false,
    schema: populationMasterSchema,
    signal,
  });
}

export async function fetchEnvironmentalReport(signal?: AbortSignal): Promise<EnvironmentalReport> {
  return apiClient.request('/api/population/env-report', {
    auth: false,
    schema: environmentalReportSchema,
    signal,
  });
}

/*
PORT STATUS
  source:     resources/js/Pages/Population/lib/data-fetcher.ts (12 lines)
  confidence: high
  todos:      0
  notes:      Both source requests use the bounded native API client and support cancellation.
*/
