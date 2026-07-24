import {
  canManageSyOfficial,
  getSyOfficialAdminAccess,
} from './Index';

const noAccess = {
  canCreate: false,
  canDelete: false,
  canEdit: false,
  canReorder: false,
  canToggle: false,
};

test('gates official account administration to source roles', () => {
  expect(canManageSyOfficial({ role: 'superadmin' })).toBe(true);
  expect(canManageSyOfficial({ role: 'admin' })).toBe(true);
  expect(canManageSyOfficial({ role: 'syofficial_admin' })).toBe(true);
  expect(canManageSyOfficial({ role: 'user' })).toBe(false);
});

test('accepts any official account permission without leaking other modules', () => {
  expect(
    canManageSyOfficial({
      permissions: ['syofficial.edit'],
      role: 'user',
    }),
  ).toBe(true);
  expect(
    canManageSyOfficial({
      permissions: ['govapps.edit'],
      role: 'user',
    }),
  ).toBe(false);
  expect(canManageSyOfficial({ permissions: ['*'], role: 'user' })).toBe(true);
  expect(canManageSyOfficial(null)).toBe(false);
});

test.each([
  ['create', 'canCreate'],
  ['delete', 'canDelete'],
  ['edit', 'canEdit'],
  ['reorder', 'canReorder'],
  ['toggle', 'canToggle'],
] as const)(
  'maps syofficial.%s to only the matching control',
  (permission, capability) => {
    const user = {
      permissions: [`syofficial.${permission}`],
      role: 'user',
    };
    expect(
      getSyOfficialAdminAccess(user),
    ).toEqual({ ...noAccess, [capability]: true });
    expect(canManageSyOfficial(user)).toBe(true);
  },
);

test.each(['admin', 'superadmin', 'syofficial_admin'] as const)(
  'grants every official account control to %s',
  (role) => {
    expect(getSyOfficialAdminAccess({ role })).toEqual({
      canCreate: true,
      canDelete: true,
      canEdit: true,
      canReorder: true,
      canToggle: true,
    });
  },
);

test('grants every official account control to the wildcard permission', () => {
  expect(
    getSyOfficialAdminAccess({
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
