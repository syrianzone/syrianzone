import { expect, test } from 'bun:test';
import raw from '../../../../resources/js/Pages/Justice/_data/detainees.json';
import { decodeJustice, justice } from './model';

test('justice preserves historical totals, hierarchy, dates and portraits', () => {
  expect(justice.meta.asOf).toBe(raw.meta.asOf);
  expect(justice.meta.totalDetainees).toBe(raw.meta.totalDetainees);
  expect(justice.individuals).toHaveLength(55);
  expect(justice.ranks).toHaveLength(15);
  expect(justice.hierarchy.groups).toHaveLength(raw.hierarchy.groups.length);
  expect(justice.individuals.filter(person => person.photo).length).toBeGreaterThan(0);
});
test('justice rejects malformed counts, dates and portrait URL schemes', () => {
  expect(() => decodeJustice({ ...raw, meta: { ...raw.meta, totalDetainees: -1 } })).toThrow();
  expect(() => decodeJustice({ ...raw, meta: { ...raw.meta, asOf: 'today' } })).toThrow();
  expect(() => decodeJustice({ ...raw, individuals: [{ name: 'اسم', role: 'صفة', photo: 'javascript:bad' }] })).toThrow();
});
