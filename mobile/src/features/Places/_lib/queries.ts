import type { QueryClient } from '@tanstack/react-query';

type AccountId = number | null | undefined;

function accountKey(accountId: AccountId): number | 'guest' {
  return accountId ?? 'guest';
}

export const placeQueryKeys = {
  admin: (accountId: AccountId, status: string, page: number) =>
    ['admin-places', accountKey(accountId), status, page] as const,
  adminAll: ['admin-places'] as const,
  all: ['places'] as const,
  detail: (accountId: AccountId, placeId: number) =>
    ['places', 'detail', accountKey(accountId), placeId] as const,
  list: (accountId: AccountId, category: string | null, query: string) =>
    ['places', 'list', accountKey(accountId), category, query] as const,
  map: (accountId: AccountId) =>
    ['places', 'map', accountKey(accountId)] as const,
  privateList: (accountId: AccountId, tab: string) =>
    ['places', tab, accountKey(accountId)] as const,
};

export async function invalidatePlaceQueries(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: placeQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: placeQueryKeys.adminAll }),
  ]);
}
