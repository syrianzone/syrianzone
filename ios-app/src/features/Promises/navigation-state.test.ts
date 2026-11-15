import { expect, test } from 'bun:test';
import { canReturnToList, rememberListVisit } from './navigation-state';
test('native Promise return context restores only the exact originating list visit', () => {
  const token = rememberListVisit(9, '/promises?sector=energy');
  expect(canReturnToList(token, 9, '/promises?sector=energy')).toBe(true);
  expect(canReturnToList(token, 10, '/promises?sector=energy')).toBe(false);
  expect(canReturnToList(token, 9, '/promises?sector=health')).toBe(false);
  expect(canReturnToList('unknown', 9, '/promises')).toBe(false);
  expect(() => rememberListVisit(9, 'https://example.com/promises')).toThrow();
});
