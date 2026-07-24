import type { AuthUser } from '@/lib/auth/types';

export const directoryAdminActions = [
  'create',
  'delete',
  'edit',
  'reorder',
  'toggle',
] as const;

export type DirectoryAdminAction =
  (typeof directoryAdminActions)[number];

export interface DirectoryAdminAccess {
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canReorder: boolean;
  canToggle: boolean;
}

const capabilityByAction = {
  create: 'canCreate',
  delete: 'canDelete',
  edit: 'canEdit',
  reorder: 'canReorder',
  toggle: 'canToggle',
} as const satisfies Record<
  DirectoryAdminAction,
  keyof DirectoryAdminAccess
>;

export function getDirectoryAdminAccess(
  user: Pick<AuthUser, 'permissions' | 'role'> | null | undefined,
  module: string,
  moduleAdminRole: string,
): DirectoryAdminAccess {
  const permissions = new Set(user?.permissions ?? []);
  const hasFullAccess =
    user?.role === 'admin' ||
    user?.role === 'superadmin' ||
    user?.role === moduleAdminRole ||
    permissions.has('*');
  const access: DirectoryAdminAccess = {
    canCreate: hasFullAccess,
    canDelete: hasFullAccess,
    canEdit: hasFullAccess,
    canReorder: hasFullAccess,
    canToggle: hasFullAccess,
  };
  if (hasFullAccess) {
    return access;
  }
  for (const action of directoryAdminActions) {
    access[capabilityByAction[action]] = permissions.has(
      `${module}.${action}`,
    );
  }
  return access;
}

export function hasDirectoryAdminAccess(
  access: DirectoryAdminAccess,
): boolean {
  return Object.values(access).some(Boolean);
}
