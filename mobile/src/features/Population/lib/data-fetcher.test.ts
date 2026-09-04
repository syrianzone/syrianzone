import { apiClient } from '@/lib/api/client';

import {
  fetchEnvironmentalReport,
  fetchOptionalEnvironmentalReport,
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

beforeEach(() => {
  jest.mocked(apiClient.request).mockReset();
});

test('uses the configured native population endpoints', async () => {
  jest.mocked(apiClient.request).mockResolvedValue(undefined as never);

  await fetchPopulationMaster();
  await fetchEnvironmentalReport();

  expect(jest.mocked(apiClient.request).mock.calls.map(([path]) => path)).toEqual([
    '/test/population/master',
    '/test/population/environment',
  ]);
});

test('a failed env report empties the climate tab without blanking the atlas', async () => {
  jest.mocked(apiClient.request).mockRejectedValue(new Error('502'));

  await expect(fetchOptionalEnvironmentalReport()).resolves.toBeNull();
});

test('an aborted env report still cancels the atlas load', async () => {
  const controller = new AbortController();
  controller.abort();
  jest.mocked(apiClient.request).mockRejectedValue(new Error('Aborted'));

  await expect(
    fetchOptionalEnvironmentalReport(controller.signal),
  ).rejects.toThrow('Aborted');
});
