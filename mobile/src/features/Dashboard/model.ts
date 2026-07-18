export type DashboardTab = 'polls' | 'profile' | 'submissions';

export interface DashboardCapabilities {
  canManagePolls: boolean;
  canReviewTransit: boolean;
  canViewSubmissions: boolean;
}

export function dashboardCapabilities(
  role: string | null | undefined,
): DashboardCapabilities {
  return {
    canManagePolls: role === 'admin' || role === 'superadmin',
    canReviewTransit:
      role === 'admin' ||
      role === 'superadmin' ||
      role === 'transit_admin',
    canViewSubmissions: role === 'user',
  };
}

export function defaultDashboardTab(role: string): DashboardTab {
  if (role === 'user') {
    return 'submissions';
  }
  if (role === 'admin' || role === 'superadmin') {
    return 'polls';
  }
  return 'profile';
}

export function dashboardTabFromParam(
  value: string | string[] | undefined,
): DashboardTab | null {
  const current = Array.isArray(value) ? value[0] : value;
  return current === 'profile' ? 'profile' : null;
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'superadmin':
      return 'مدير عام (Superadmin)';
    case 'admin':
      return 'مدير تصويت وتنقل (Admin)';
    case 'transit_admin':
      return 'مراقب خطوط تنقل (Transit Admin)';
    default:
      return 'عضو مساهم (User)';
  }
}

export function draftStatusLabel(
  status: 'approved' | 'pending' | 'rejected',
): string {
  switch (status) {
    case 'approved':
      return 'تم القبول والنشر';
    case 'rejected':
      return 'مرفوض';
    default:
      return 'قيد المراجعة';
  }
}
