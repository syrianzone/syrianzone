import { expect, test } from 'bun:test';
import { decodeAccountUser } from './account-model';

test('uses server-resolved capabilities without granting permissions from role names', () => {
  const user = decodeAccountUser({ id: 4, name: 'اسم', email: 'a@example.com', role: 'superadmin', effective_permissions: ['places.create'], settings: null, transit_scope: null });
  expect(user.effective_permissions).toEqual(['places.create']);
  expect(user.settings).toEqual({});
  expect(decodeAccountUser({ ...user, transit_scope: ['damascus'] }).transit_scope).toEqual(['damascus']);
  expect(() => decodeAccountUser({ ...user, transit_scope: [false] })).toThrow();
  expect(() => decodeAccountUser({ ...user, effective_permissions: ['places.create', false] })).toThrow();
  expect(() => decodeAccountUser({ ...user, is_banned: true })).toThrow();
});

test('adopts valid user JSON with the legacy empty PHP settings array', () => {
  const json = '{"id":102,"name":"مستخدم اختبار ثان","email":"other@native-fixture.invalid","role":"user","avatar_url":null,"effective_permissions":[],"settings":[],"transit_scope":null,"is_banned":false}';
  expect(decodeAccountUser(JSON.parse(json))).toEqual({ id: 102, name: 'مستخدم اختبار ثان', email: 'other@native-fixture.invalid',
    role: 'user', avatar_url: null, effective_permissions: [], settings: {}, transit_scope: null });
});

test('rejects every nonempty settings array while retaining null, absent and object settings', () => {
  const user = { id: 102, name: 'مستخدم اختبار ثان', email: 'other@native-fixture.invalid', role: 'user', avatar_url: null,
    effective_permissions: [], transit_scope: null, is_banned: false };
  for (const settings of [[null], [{}], ['value'], [false], [0], [[], []]])
    expect(() => decodeAccountUser({ ...user, settings })).toThrow();
  expect(decodeAccountUser({ ...user, settings: null }).settings).toEqual({});
  expect(decodeAccountUser(user).settings).toEqual({});
  const settings = { prayerEnabled: false, prayerMethod: 3, unrelated: { preserved: true } };
  expect(decodeAccountUser({ ...user, settings }).settings).toEqual(settings);
});
