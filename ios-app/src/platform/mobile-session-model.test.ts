import { expect, test } from 'bun:test';
import { decodeMobileSession, superadminCredentials } from './mobile-session-model';

const user = { id: 103, name: 'مدير محلي', email: 'admin@native-fixture.invalid', role: 'user', avatar_url: null, effective_permissions: ['places.create'], settings: {}, transit_scope: null };
const session = { token: `1|sz_${'a'.repeat(40)}`, token_type: 'Bearer', expires_at: null, user };
test('Google and superadmin sessions share strict server DTO decoding without client role inference', () => {
  expect(decodeMobileSession(session)).toMatchObject({ token: session.token, user: { id: 103, role: 'user', effective_permissions: ['places.create'] } });
  expect(decodeMobileSession({ ...session, expires_at: '2026-12-14T12:00:00+00:00' }).expiresAt).toBe('2026-12-14T12:00:00+00:00');
  for (const invalid of [{ ...session, token: '' }, { ...session, token: 'bad\r\nheader' }, { ...session, token_type: 'Basic' }, { ...session, expires_at: 'tomorrow' }, { ...session, user: { ...user, is_banned: true } }])
    expect(() => decodeMobileSession(invalid)).toThrow();
});
test('native superadmin credentials preserve literal passwords and accept source-valid localhost email without an invented password policy', () => {
  expect(superadminCredentials(' admin@localhost ', ' a ')).toEqual({ email: 'admin@localhost', password: ' a ', device_name: 'Syrian Zone iOS' });
  expect(superadminCredentials('admin@example.com', 'x').password).toBe('x');
  expect(superadminCredentials('admin@example.com', '\u00a0').password).toBe('\u00a0');
  for (const [email, password] of [['', 'x'], ['a', 'x'], ['a@host', ''], ['a@host', '   ']]) expect(() => superadminCredentials(email ?? '', password ?? '')).toThrow();
});
