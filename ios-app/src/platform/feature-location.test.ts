import { expect, test } from 'bun:test';
import { featureParameters } from './feature-location';

test('preserves native nested arguments and flat URL query arguments', () => {
  expect(featureParameters({ section: 'promises', view: 'admin-edit', id: 'abc' })).toEqual({ view: 'admin-edit', id: 'abc' });
  expect(featureParameters({ section: 'muslim_quran', params: { surah: '2', ayah: '255' } })).toEqual({ surah: '2', ayah: '255' });
  expect(featureParameters({ section: 'atlas', params: '{"layer":"population"}' })).toEqual({ layer: 'population' });
  expect(featureParameters({ section: 'dashboard', 'edit-poll': 'existing', 'create-poll': '1' })).toEqual({ 'edit-poll': 'existing', 'create-poll': '1' });
});

test('rejects malformed or oversized feature arguments before opening a screen', () => {
  for (const value of [{ params: 'false' }, { params: '{' }, { params: { id: [] } }, { id: 'a'.repeat(4097) }]) {
    expect(() => featureParameters(value)).toThrow('الرابط');
  }
  expect(featureParameters({ section: 'games', params: JSON.parse('{"__proto__":"x","q":"سوريا"}') })).toEqual({ q: 'سوريا' });
});
