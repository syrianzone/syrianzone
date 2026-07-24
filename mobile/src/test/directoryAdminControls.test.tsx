import {
  fireEvent,
  render,
} from '@testing-library/react-native';
import type { ReactElement } from 'react';

import type { DirectoryAdminAccess } from '@/components/directory';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { GovernmentAppManager } from '@/features/GovApps/Admin/Index';
import { PhonebookEntryManager } from '@/features/Phonebook/Admin/Index';
import { OfficialEntityManager } from '@/features/SyOfficial/Admin/Index';
import type {
  AdminGovernmentApp,
  AdminOfficialCategory,
  AdminOfficialEntity,
  AdminPhonebookCategory,
  AdminPhonebookEntry,
} from '@/lib/api/directories/admin';

const governmentApp: AdminGovernmentApp = {
  description: null,
  description_ar: null,
  icon: null,
  id: 'app',
  images: [],
  is_active: true,
  links: {},
  name: 'App',
  name_ar: 'تطبيق',
  order_column: 0,
};
const phonebookCategory: AdminPhonebookCategory = {
  icon: null,
  id: 'services',
  is_active: true,
  label_ar: 'خدمات',
  label_en: 'Services',
  order_column: 0,
};
const phonebookEntry: AdminPhonebookEntry = {
  category_id: phonebookCategory.id,
  id: 'entry',
  is_active: true,
  is_whatsapp: false,
  name_ar: 'جهة',
  name_en: 'Entry',
  number: '100',
  order_column: 0,
  source_url: null,
};
const officialCategory: AdminOfficialCategory = {
  icon: null,
  id: 'ministries',
  is_active: true,
  label_ar: 'وزارات',
  label_en: 'Ministries',
  order_column: 0,
};
const officialEntity: AdminOfficialEntity = {
  category_id: officialCategory.id,
  description: null,
  description_ar: null,
  id: 'entity',
  image: null,
  is_active: true,
  name: 'Entity',
  name_ar: 'جهة رسمية',
  order_column: 0,
  socials: {},
};

const capabilityByAction = {
  create: 'canCreate',
  delete: 'canDelete',
  edit: 'canEdit',
  reorder: 'canReorder',
  toggle: 'canToggle',
} as const;

function accessFor(
  action: keyof typeof capabilityByAction,
): DirectoryAdminAccess {
  return {
    canCreate: false,
    canDelete: false,
    canEdit: false,
    canReorder: false,
    canToggle: false,
    [capabilityByAction[action]]: true,
  };
}

const noop = jest.fn();
const moduleCases: {
  createHeading: string;
  module: string;
  renderManager: (access: DirectoryAdminAccess) => ReactElement;
  toggleTestId: string;
}[] = [
  {
    createHeading: 'إضافة تطبيق',
    module: 'govapps',
    renderManager: (access) => (
      <GovernmentAppManager
        access={access}
        apps={[governmentApp]}
        busy={null}
        onDelete={noop}
        onReorder={noop}
        onSave={noop}
        onVisibility={noop}
      />
    ),
    toggleTestId: 'toggle-app',
  },
  {
    createHeading: 'إضافة رقم',
    module: 'phonebook',
    renderManager: (access) => (
      <PhonebookEntryManager
        access={access}
        busy={null}
        categories={[phonebookCategory]}
        entries={[phonebookEntry]}
        onDelete={noop}
        onReorder={noop}
        onSave={noop}
        onVisibility={noop}
      />
    ),
    toggleTestId: 'toggle-entry',
  },
  {
    createHeading: 'إضافة جهة',
    module: 'syofficial',
    renderManager: (access) => (
      <OfficialEntityManager
        access={access}
        busy={null}
        categories={[officialCategory]}
        entities={[officialEntity]}
        onDelete={noop}
        onReorder={noop}
        onSave={noop}
        onVisibility={noop}
      />
    ),
    toggleTestId: 'toggle-entity',
  },
];

const actions = [
  'create',
  'delete',
  'edit',
  'reorder',
  'toggle',
] as const;

async function renderManagerView(
  manager: (access: DirectoryAdminAccess) => ReactElement,
  access: DirectoryAdminAccess,
) {
  return render(
    <LocaleProvider>
      <AppThemeProvider>{manager(access)}</AppThemeProvider>
    </LocaleProvider>,
  );
}

test.each(
  moduleCases.flatMap((moduleCase) =>
    actions.map((action) => ({ action, ...moduleCase })),
  ),
)(
  '$module renders only $action controls for a narrow permission',
  async ({
    action,
    createHeading,
    renderManager: renderModule,
    toggleTestId,
  }) => {
    const view = await renderManagerView(
      renderModule,
      accessFor(action),
    );

    expect(Boolean(view.queryByText(createHeading))).toBe(
      action === 'create',
    );
    expect(view.queryAllByText('تعديل')).toHaveLength(
      action === 'edit' ? 1 : 0,
    );
    expect(view.queryAllByText('حذف')).toHaveLength(
      action === 'delete' ? 1 : 0,
    );
    expect(
      view.queryAllByLabelText('تحريك إلى الأعلى'),
    ).toHaveLength(action === 'reorder' ? 1 : 0);
    expect(Boolean(view.queryByTestId(toggleTestId))).toBe(
      action === 'toggle',
    );
  },
);

test.each(moduleCases)(
  '$module hides item visibility from edit-only users',
  async ({ module, renderManager: renderModule, toggleTestId }) => {
    const view = await renderManagerView(
      renderModule,
      accessFor('edit'),
    );
    await fireEvent.press(view.getByText('تعديل'));
    expect(view.queryByTestId('form-visibility')).toBeNull();
    expect(view.queryByTestId(toggleTestId)).toBeNull();
    expect(view.queryAllByRole('switch')).toHaveLength(
      module === 'phonebook' ? 1 : 0,
    );
  },
);

test.each(moduleCases)(
  '$module exposes item visibility when edit and toggle are both granted',
  async ({ renderManager: renderModule, toggleTestId }) => {
    const view = await renderManagerView(renderModule, {
      ...accessFor('edit'),
      canToggle: true,
    });
    await fireEvent.press(view.getByText('تعديل'));
    expect(view.getByTestId('form-visibility')).toBeTruthy();
    expect(view.getByTestId(toggleTestId)).toBeTruthy();
  },
);

test.each(moduleCases)(
  '$module lets create-only users choose initial item visibility',
  async ({ renderManager: renderModule, toggleTestId }) => {
    const view = await renderManagerView(
      renderModule,
      accessFor('create'),
    );
    expect(view.getByTestId('form-visibility')).toBeTruthy();
    expect(view.queryByTestId(toggleTestId)).toBeNull();
  },
);
