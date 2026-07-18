import {
  dashboardCapabilities,
  dashboardTabFromParam,
  defaultDashboardTab,
  draftStatusLabel,
  roleLabel,
} from './model';

describe('dashboard role contract', () => {
  test('maps all four source roles to their permitted sections', () => {
    expect(dashboardCapabilities('user')).toEqual({
      canManagePolls: false,
      canReviewTransit: false,
      canViewSubmissions: true,
    });
    expect(dashboardCapabilities('transit_admin')).toEqual({
      canManagePolls: false,
      canReviewTransit: true,
      canViewSubmissions: false,
    });
    expect(dashboardCapabilities('admin')).toEqual({
      canManagePolls: true,
      canReviewTransit: true,
      canViewSubmissions: false,
    });
    expect(dashboardCapabilities('superadmin')).toEqual(
      dashboardCapabilities('admin'),
    );
  });

  test('preserves source default tabs and human role labels', () => {
    expect(defaultDashboardTab('user')).toBe('submissions');
    expect(defaultDashboardTab('transit_admin')).toBe('profile');
    expect(defaultDashboardTab('admin')).toBe('polls');
    expect(roleLabel('superadmin')).toContain('Superadmin');
  });

  test('honors only the shared profile deep link', () => {
    expect(dashboardTabFromParam('profile')).toBe('profile');
    expect(dashboardTabFromParam(['profile', 'polls'])).toBe('profile');
    expect(dashboardTabFromParam('polls')).toBeNull();
    expect(dashboardTabFromParam(undefined)).toBeNull();
  });

  test('keeps every submission status label', () => {
    expect(draftStatusLabel('pending')).toBe('قيد المراجعة');
    expect(draftStatusLabel('approved')).toBe('تم القبول والنشر');
    expect(draftStatusLabel('rejected')).toBe('مرفوض');
  });
});
