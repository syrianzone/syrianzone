import { environmentManager } from '@tanstack/react-query';

import { createQueryClient } from './client';

const nativeGcTime = 30 * 60 * 1000;
const originalServerState = environmentManager.isServer();

afterEach(() => {
  environmentManager.setIsServer(() => originalServerState);
});

test.each([
  { expectedGcTime: Infinity, isServer: true, runtime: 'server rendering' },
  { expectedGcTime: nativeGcTime, isServer: false, runtime: 'the app runtime' },
])('uses the correct query garbage collection for $runtime', ({
  expectedGcTime,
  isServer,
}) => {
  environmentManager.setIsServer(() => isServer);

  expect(
    createQueryClient().getDefaultOptions().queries?.gcTime,
  ).toBe(expectedGcTime);
});
