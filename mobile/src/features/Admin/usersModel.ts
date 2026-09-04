import type {
  AssignableUserRole,
  ManagedUser,
  ManagedUserRole,
} from './usersApi';

export const assignableUserRoles: readonly AssignableUserRole[] = [
  'user',
  'transit_admin',
  'admin',
];

export interface ManagedUserBanConfirmation {
  actionText: string;
  message: string;
  nextState: boolean;
  title: string;
}

const roleLabels: Readonly<Record<string, string>> = {
  admin: 'مدير',
  govapps_admin: 'مدير التطبيقات الحكومية',
  phonebook_admin: 'مدير دليل الهاتف',
  superadmin: 'مدير عام',
  syofficial_admin: 'مدير الحسابات الرسمية',
  transit_admin: 'مراجع ترانزيت',
  user: 'مساهم',
};

// A role the app has not learned yet renders raw instead of masquerading as a
// contributor, which would understate the account's access.
export function managedUserRoleLabel(role: ManagedUserRole): string {
  return roleLabels[role] ?? role;
}

export function filterManagedUsers(
  users: readonly ManagedUser[],
  search: string,
): ManagedUser[] {
  const query = search.trim().toLocaleLowerCase('ar');
  if (!query) {
    return [...users];
  }
  return users.filter((user) =>
    [user.name, user.email, managedUserRoleLabel(user.role)].some((value) =>
      value.toLocaleLowerCase('ar').includes(query),
    ),
  );
}

// DELETE /mobile/admin/users/{user} is superadmin-only and refuses the final
// superadmin, so the app hides the button for every superadmin row.
export function canDeleteManagedUser(
  actorId: number,
  target: ManagedUser,
): boolean {
  return actorId !== target.id && target.role !== 'superadmin';
}

// Mirrors AdminUserController::canModerate; the ban route rejects any other
// target with insufficient_target_role, including the directory admin roles.
const moderatableRoles: Readonly<Record<string, readonly string[]>> = {
  admin: ['transit_admin', 'user'],
  superadmin: ['admin', 'transit_admin', 'user'],
  transit_admin: ['user'],
};

export function canBanManagedUser(
  actor: Pick<ManagedUser, 'id' | 'role'>,
  target: ManagedUser,
): boolean {
  if (actor.id === target.id) {
    return false;
  }
  return (moderatableRoles[actor.role] ?? []).includes(target.role);
}

export function managedUserBanConfirmation(
  target: Pick<ManagedUser, 'is_banned' | 'name'>,
): ManagedUserBanConfirmation {
  const nextState = !target.is_banned;
  return {
    actionText: nextState ? 'حظر' : 'إلغاء الحظر',
    message: nextState
      ? `سيتم حظر حساب ${target.name} وسحب جلساته الحالية.`
      : `سيتمكن ${target.name} من تسجيل الدخول مجددًا.`,
    nextState,
    title: nextState ? 'حظر الحساب؟' : 'إلغاء حظر الحساب؟',
  };
}
