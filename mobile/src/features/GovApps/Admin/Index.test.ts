import {
  canManageGovernmentApps,
  getGovernmentAppsAdminAccess,
} from './Index';

const noAccess = {
  canCreate: false,
  canDelete: false,
  canEdit: false,
  canReorder: false,
  canToggle: false,
};

test('gates government app administration to source roles', () => {
  expect(canManageGovernmentApps({ role: 'superadmin' })).toBe(true);
  expect(canManageGovernmentApps({ role: 'admin' })).toBe(true);
  expect(canManageGovernmentApps({ role: 'govapps_admin' })).toBe(true);
  expect(canManageGovernmentApps({ role: 'user' })).toBe(false);
});

test('accepts any government app permission without leaking other modules', () => {
  expect(
    canManageGovernmentApps({
      permissions: ['govapps.reorder'],
      role: 'user',
    }),
  ).toBe(true);
  expect(
    canManageGovernmentApps({
      permissions: ['syofficial.reorder'],
      role: 'user',
    }),
  ).toBe(false);
  expect(
    canManageGovernmentApps({ permissions: ['*'], role: 'user' }),
  ).toBe(true);
  expect(canManageGovernmentApps(undefined)).toBe(false);
});

test.each([
  ['create', 'canCreate'],
  ['delete', 'canDelete'],
  ['edit', 'canEdit'],
  ['reorder', 'canReorder'],
  ['toggle', 'canToggle'],
] as const)(
  'maps govapps.%s to only the matching control',
  (permission, capability) => {
    const user = {
      permissions: [`govapps.${permission}`],
      role: 'user',
    };
    expect(
      getGovernmentAppsAdminAccess(user),
    ).toEqual({ ...noAccess, [capability]: true });
    expect(canManageGovernmentApps(user)).toBe(true);
  },
);

test.each(['admin', 'superadmin', 'govapps_admin'] as const)(
  'grants every government app control to %s',
  (role) => {
    expect(getGovernmentAppsAdminAccess({ role })).toEqual({
      canCreate: true,
      canDelete: true,
      canEdit: true,
      canReorder: true,
      canToggle: true,
    });
  },
);

test('grants every government app control to the wildcard permission', () => {
  expect(
    getGovernmentAppsAdminAccess({
      permissions: ['*'],
      role: 'user',
    }),
  ).toEqual({
    canCreate: true,
    canDelete: true,
    canEdit: true,
    canReorder: true,
    canToggle: true,
  });
});
