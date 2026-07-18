import type { ManagedUser } from './usersApi';
import {
  canMutateManagedUser,
  filterManagedUsers,
  managedUserBanConfirmation,
  managedUserRoleLabel,
} from './usersModel';

function user(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    avatar_url: null,
    created_at: '2026-07-16T10:00:00Z',
    email: 'member@example.test',
    id: 1,
    is_banned: false,
    name: 'مساهم',
    role: 'user',
    ...overrides,
  };
}

describe('managed user model', () => {
  test('filters Arabic names, email addresses, and localized roles', () => {
    const users = [
      user(),
      user({ email: 'reviewer@example.test', id: 2, name: 'مراجع', role: 'transit_admin' }),
    ];
    expect(filterManagedUsers(users, 'مراجع').map((item) => item.id)).toEqual([2]);
    expect(filterManagedUsers(users, 'MEMBER@').map((item) => item.id)).toEqual([1]);
    expect(filterManagedUsers(users, 'ترانزيت').map((item) => item.id)).toEqual([2]);
  });

  test('protects the acting account and every superadmin', () => {
    expect(canMutateManagedUser(1, user())).toBe(false);
    expect(canMutateManagedUser(1, user({ id: 2 }))).toBe(true);
    expect(canMutateManagedUser(1, user({ id: 2, role: 'superadmin' }))).toBe(false);
    expect(managedUserRoleLabel('admin')).toBe('مدير');
  });

  test.each([
    [false, true, 'حظر الحساب؟', 'حظر'],
    [true, false, 'إلغاء حظر الحساب؟', 'إلغاء الحظر'],
  ])(
    'builds a confirmation before changing ban state from %s',
    (currentState, nextState, title, actionText) => {
      expect(managedUserBanConfirmation(user({ is_banned: currentState }))).toMatchObject({
        actionText,
        nextState,
        title,
      });
    },
  );
});
