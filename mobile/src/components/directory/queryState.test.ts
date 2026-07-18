import { getDirectoryQueryPresentation } from './queryState';

test('turns a cold paused query into a retryable error, not endless loading', () => {
  expect(
    getDirectoryQueryPresentation({
      data: undefined,
      fetchStatus: 'paused',
      isError: false,
      isFetching: false,
      isPending: true,
    }),
  ).toEqual({
    cached: false,
    error: true,
    loading: false,
    refreshing: false,
  });
});

test('labels paused last-good data as cached', () => {
  expect(
    getDirectoryQueryPresentation({
      data: [],
      fetchStatus: 'paused',
      isError: false,
      isFetching: false,
      isPending: false,
    }),
  ).toEqual({
    cached: true,
    error: false,
    loading: false,
    refreshing: false,
  });
});

test('keeps ordinary loading and refresh states distinct', () => {
  expect(
    getDirectoryQueryPresentation({
      data: undefined,
      fetchStatus: 'fetching',
      isError: false,
      isFetching: true,
      isPending: true,
    }),
  ).toMatchObject({ loading: true, refreshing: false });
  expect(
    getDirectoryQueryPresentation({
      data: ['cached'],
      fetchStatus: 'fetching',
      isError: false,
      isFetching: true,
      isPending: false,
    }),
  ).toMatchObject({ loading: false, refreshing: true });
});
