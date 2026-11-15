import { expect, test } from 'bun:test';
import { decodeAdminFigures, decodeAdminPersonas, figurePayload, personaPayload } from './admin-model';

test('Compass editors preserve null axes, bounds and source API field names', () => {
  const body = figurePayload({ name: 'شخصية', category: 'current', align: 'neutral', enabled: false, positions: { auth_lib: '', central_federal: '-0.75' }, imageUrl: null, imagePath: null, sortOrder: '2' }, ['current']);
  expect(body.positions.auth_lib).toBeNull(); expect(body.positions.central_federal).toBe(-0.75); expect(body.enabled).toBe(false); expect(body.sort_order).toBe(2);
  expect(() => figurePayload({ name: 'س', category: 'current', align: 'neutral', enabled: true, positions: { auth_lib: 'Infinity' }, imageUrl: null, imagePath: null, sortOrder: '2' }, ['current'])).toThrow();
  expect(() => figurePayload({ name: 'س', category: 'invented', align: 'neutral', enabled: true, positions: {}, imageUrl: null, imagePath: null, sortOrder: '2' }, ['current'])).toThrow();
});

test('Compass persona center and optional range bounds serialize source semantics', () => {
  const form = { name: 'نمط', icon: 'Shield', short: '', factoid: '', stances: [' أ ', ''], enabled: true, center: { auth_lib: '0' }, ranges: { auth_lib: { min: '', max: '0.5' } }, sortOrder: '0' };
  const payload = personaPayload(form, ['Shield']); expect(payload.center.auth_lib).toBe(0); expect(payload.ranges?.auth_lib).toEqual({ min: null, max: 0.5 }); expect(payload.stances).toEqual(['أ']);
  expect('slug' in payload).toBe(false);
  expect(() => personaPayload({ ...form, ranges: { auth_lib: { min: '0.8', max: '-0.8' } } }, ['Shield'])).toThrow();
  expect(() => personaPayload({ ...form, stances: Array.from({ length: 13 }, () => 'رأي') }, ['Shield'])).toThrow();
});

test('Compass privileged roster validates server identities and sparse PHP dictionaries', () => {
  expect(decodeAdminFigures({ figures: [{ id: 1, name: 'س', category: 'current', align: 'neutral', positions: [], imagePath: null, imageUrl: null, enabled: false, sortOrder: 0 }], categories: ['current'] }).figures[0]?.positions).toEqual({});
  const persona = { id: 1, slug: 'fixed', name: 'نمط', icon: 'Shield', short: '', factoid: '', stances: [], center: [], ranges: [], enabled: true, sortOrder: 0 };
  expect(decodeAdminPersonas({ personas: [persona], icons: ['Shield'] }).personas[0]?.slug).toBe('fixed');
  expect(() => decodeAdminPersonas({ personas: [persona, persona], icons: ['Shield'] })).toThrow();
});
