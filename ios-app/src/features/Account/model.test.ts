import { expect, test } from 'bun:test';
import { profileErrors, confirmedAccountDelete } from './model';
test('profile input keeps Arabic names and surfaces required/length/email errors before a mutation', () => {
  expect(profileErrors('اسم عربي', 'name@example.com')).toEqual({});
  expect(profileErrors(' ', 'not-an-email')).toHaveProperty('name');
  expect(profileErrors(' ', 'not-an-email')).toHaveProperty('email');
  expect(profileErrors('ع'.repeat(256), 'name@example.com')).toHaveProperty('name');
  expect(() => confirmedAccountDelete({ ok: false })).toThrow();
  expect(confirmedAccountDelete({ ok: true })).toBeUndefined();
});
