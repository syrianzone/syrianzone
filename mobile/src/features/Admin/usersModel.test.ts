import type { ManagedUser } from './usersApi';
import {
  canBanManagedUser,
  canDeleteManagedUser,
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

  test('protects the acting account and every superadmin from deletion', () => {
    expect(canDeleteManagedUser(1, user())).toBe(false);
    expect(canDeleteManagedUser(1, user({ id: 2 }))).toBe(true);
    expect(canDeleteManagedUser(1, user({ id: 2, role: 'superadmin' }))).toBe(false);
    expect(managedUserRoleLabel('admin')).toBe('مدير');
  });

  test('labels every backend role and falls back to the raw unknown role', () => {
    expect(managedUserRoleLabel('superadmin')).toBe('مدير عام');
    expect(managedUserRoleLabel('syofficial_admin')).toBe('مدير الحسابات الرسمية');
    expect(managedUserRoleLabel('govapps_admin')).toBe('مدير التطبيقات الحكومية');
    expect(managedUserRoleLabel('phonebook_admin')).toBe('مدير دليل الهاتف');
    expect(managedUserRoleLabel('user')).toBe('مساهم');
    expect(managedUserRoleLabel('future_admin')).toBe('future_admin');
  });

  test('offers the ban action only for targets the ban route accepts', () => {
    const actor = { id: 1, role: 'superadmin' };
    expect(canBanManagedUser(actor, user({ id: 2, role: 'admin' }))).toBe(true);
    expect(canBanManagedUser(actor, user({ id: 2, role: 'transit_admin' }))).toBe(true);
    expect(canBanManagedUser(actor, user({ id: 2, role: 'syofficial_admin' }))).toBe(false);
    expect(canBanManagedUser(actor, user({ id: 2, role: 'superadmin' }))).toBe(false);
    expect(canBanManagedUser(actor, user({ id: 1 }))).toBe(false);
    expect(
      canBanManagedUser({ id: 3, role: 'transit_admin' }, user({ id: 2, role: 'admin' })),
    ).toBe(false);
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
