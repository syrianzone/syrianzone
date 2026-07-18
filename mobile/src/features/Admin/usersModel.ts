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

export function managedUserRoleLabel(role: ManagedUserRole): string {
  switch (role) {
    case 'superadmin':
      return 'مدير عام';
    case 'admin':
      return 'مدير';
    case 'transit_admin':
      return 'مراجع ترانزيت';
    default:
      return 'مساهم';
  }
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

export function canMutateManagedUser(
  actorId: number,
  target: ManagedUser,
): boolean {
  return actorId !== target.id && target.role !== 'superadmin';
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
