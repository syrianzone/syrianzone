import { moveDirectoryId } from './DirectoryAdminControls';

test('moves one directory item without mutating the source list', () => {
  const ids = ['first', 'second', 'third'];
  expect(moveDirectoryId(ids, 1, -1)).toEqual([
    'second',
    'first',
    'third',
  ]);
  expect(ids).toEqual(['first', 'second', 'third']);
  expect(moveDirectoryId(ids, 0, -1)).toEqual(ids);
});
