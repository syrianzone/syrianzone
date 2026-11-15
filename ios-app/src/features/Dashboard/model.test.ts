import { expect, test } from 'bun:test';
import {
  allowedAdminCards,
  decodeDashboard,
  eligibleSuccessors,
  initialDashboardTab,
  pollFormErrors,
} from './model';
test('native user-management entry trusts the authoritative flag instead of role or other capabilities', () => {
  const page = { auth: { user: { is_banned: false } }, role: 'superadmin', polls: [], myDrafts: [] };
  expect(decodeDashboard(page).canManageUsers).toBe(false);
  expect(decodeDashboard({ ...page, canManageUsers: false }).canManageUsers).toBe(false);
  expect(decodeDashboard({ ...page, role: 'user', canManageUsers: true }).canManageUsers).toBe(true);
  expect(() => decodeDashboard({ ...page, canManageUsers: 'true' })).toThrow();
});
test('dashboard uses server capabilities and source tab priority rather than role names', () => {
  expect(allowedAdminCards([])).toHaveLength(0);
  expect(allowedAdminCards(['promises.review']).map((row) => row.id)).toEqual(['promises', 'api_tokens']);
  expect(allowedAdminCards(['unknown.future']).map((row) => row.id)).toEqual([]);
  expect(initialDashboardTab({}, ['polls.delete'], true)).toBe('polls');
  expect(initialDashboardTab({ tab: 'profile' }, ['polls.edit'], true)).toBe('profile');
  expect(initialDashboardTab({}, [], false)).toBe('profile');
});
test('poll forms preserve source core guards and successor choices stay active in the same group', () => {
  expect(pollFormErrors('اسم', 'best-ministers', 'best-ministers')).toEqual({});
  expect(pollFormErrors('اسم', 'renamed', 'best-ministers')).toHaveProperty('slug');
  const base = {
    id: 'a',
    name: 'اسم',
    groupId: 'g',
    status: 'active' as const,
    title: '',
    handle: '',
    image: null,
    termStart: '',
    termEnd: '',
    reason: '',
    successorId: null,
  };
  expect(
    eligibleSuccessors(base, [
      base,
      { ...base, id: 'b' },
      { ...base, id: 'c', groupId: 'other' },
      { ...base, id: 'd', status: 'archived' },
    ]).map((row) => row.id),
  ).toEqual(['b']);
});
