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

/**
 * The website keeps the map and the demographic tabs alive when `envData` is
 * missing and only empties the climate tab, so an env-report failure must not
 * fail the whole atlas load here either. Aborts still propagate.
 */
export async function fetchOptionalEnvironmentalReport(
  signal?: AbortSignal,
): Promise<EnvironmentalReport | null> {
  try {
    return await fetchEnvironmentalReport(signal);
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    return null;
  }
}

/*
PORT STATUS
  source:     resources/js/Pages/Population/lib/data-fetcher.ts (12 lines)
  confidence: high
  todos:      0
  notes:      Both source requests use the bounded native API client, support cancellation,
              and the climate report degrades on its own like the website does.
*/
