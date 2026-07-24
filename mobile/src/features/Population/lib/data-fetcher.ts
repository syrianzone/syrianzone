import { apiClient } from '@/lib/api/client';

import {
  POPULATION_ENVIRONMENT_PATH,
  POPULATION_MASTER_PATH,
} from '../constants/api-config';
import type { EnvironmentalReport, PopulationMasterData } from '../types';
import { environmentalReportSchema, populationMasterSchema } from './schemas';

export async function fetchPopulationMaster(
  signal?: AbortSignal,
): Promise<PopulationMasterData> {
  return apiClient.request(POPULATION_MASTER_PATH, {
    auth: false,
    schema: populationMasterSchema,
    signal,
  });
}

export async function fetchEnvironmentalReport(
  signal?: AbortSignal,
): Promise<EnvironmentalReport> {
  return apiClient.request(POPULATION_ENVIRONMENT_PATH, {
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
