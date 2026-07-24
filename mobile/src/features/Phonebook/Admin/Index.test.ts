import {
  canManagePhonebook,
  getPhonebookAdminAccess,
} from './Index';

const noAccess = {
  canCreate: false,
  canDelete: false,
  canEdit: false,
  canReorder: false,
  canToggle: false,
};

test('gates phonebook administration to native-visible source roles', () => {
  expect(canManagePhonebook({ role: 'superadmin' })).toBe(true);
  expect(canManagePhonebook({ role: 'admin' })).toBe(true);
  expect(canManagePhonebook({ role: 'phonebook_admin' })).toBe(true);
  expect(canManagePhonebook({ role: 'user' })).toBe(false);
  expect(canManagePhonebook(null)).toBe(false);
});

test('accepts any phonebook permission without leaking other modules', () => {
  expect(
    canManagePhonebook({
      permissions: ['phonebook.create'],
      role: 'user',
    }),
  ).toBe(true);
  expect(
    canManagePhonebook({
      permissions: ['phonebook.delete'],
      role: 'user',
    }),
  ).toBe(true);
  expect(
    canManagePhonebook({
      permissions: ['places.edit'],
      role: 'user',
    }),
  ).toBe(false);
  expect(canManagePhonebook({ permissions: ['*'], role: 'user' })).toBe(true);
});

test.each([
  ['create', 'canCreate'],
  ['delete', 'canDelete'],
  ['edit', 'canEdit'],
  ['reorder', 'canReorder'],
  ['toggle', 'canToggle'],
] as const)(
  'maps phonebook.%s to only the matching control',
  (permission, capability) => {
    const user = {
      permissions: [`phonebook.${permission}`],
      role: 'user',
    };
    expect(
      getPhonebookAdminAccess(user),
    ).toEqual({ ...noAccess, [capability]: true });
    expect(canManagePhonebook(user)).toBe(true);
  },
);

test.each(['admin', 'superadmin', 'phonebook_admin'] as const)(
  'grants every phonebook control to %s',
  (role) => {
    expect(getPhonebookAdminAccess({ role })).toEqual({
      canCreate: true,
      canDelete: true,
      canEdit: true,
      canReorder: true,
      canToggle: true,
    });
  },
);

test('grants every phonebook control to the wildcard permission', () => {
  expect(
    getPhonebookAdminAccess({
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
