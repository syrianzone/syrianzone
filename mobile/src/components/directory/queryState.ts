interface DirectoryQuerySnapshot<T> {
  data: T | undefined;
  fetchStatus: 'fetching' | 'idle' | 'paused';
  isError: boolean;
  isFetching: boolean;
  isPending: boolean;
}

export interface DirectoryQueryPresentation {
  cached: boolean;
  error: boolean;
  loading: boolean;
  refreshing: boolean;
}

export function getDirectoryQueryPresentation<T>(
  query: DirectoryQuerySnapshot<T>,
): DirectoryQueryPresentation {
  const hasData = query.data !== undefined;
  const paused = query.fetchStatus === 'paused';

  return {
    cached: hasData && (query.isError || paused),
    error: !hasData && (query.isError || paused),
    loading: query.isPending && !paused,
    refreshing: query.isFetching && !query.isPending,
  };
}
