import { apiClient } from '@/lib/api/client';

import {
  fetchEnvironmentalReport,
  fetchPopulationMaster,
} from './data-fetcher';

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

jest.mock('../constants/api-config', () => ({
  POPULATION_ENVIRONMENT_PATH: '/test/population/environment',
  POPULATION_MASTER_PATH: '/test/population/master',
}));

test('uses the configured native population endpoints', async () => {
  jest.mocked(apiClient.request).mockResolvedValue(undefined as never);

  await fetchPopulationMaster();
  await fetchEnvironmentalReport();

  expect(jest.mocked(apiClient.request).mock.calls.map(([path]) => path)).toEqual([
    '/test/population/master',
    '/test/population/environment',
  ]);
});
