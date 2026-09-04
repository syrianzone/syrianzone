import {
  fireEvent,
  render,
  type RenderResult,
} from '@testing-library/react-native';

import type { DirectoryAdminAccess } from '@/components/directory';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import type {
  AdminOfficialCategory,
  AdminOfficialEntity,
} from '@/lib/api/directories/admin';

import { OfficialEntityManager } from './Index';

const UP_LABEL = 'تحريك إلى الأعلى';

const fullAccess: DirectoryAdminAccess = {
  canCreate: true,
  canDelete: true,
  canEdit: true,
  canReorder: true,
  canToggle: true,
};

function category(id: string, labelAr: string): AdminOfficialCategory {
  return {
    icon: null,
    id,
    is_active: true,
    label_ar: labelAr,
    label_en: id,
    order_column: 0,
  };
}

function entity(
  id: string,
  categoryId: string,
  nameAr: string,
  name: string,
): AdminOfficialEntity {
  return {
    category_id: categoryId,
    description: null,
    description_ar: null,
    id,
    image: null,
    is_active: true,
    name,
    name_ar: nameAr,
    order_column: 0,
    socials: {},
  };
}

const categories = [category('A', 'سيادية'), category('B', 'وزارات')];
// The API sorts by order_column across categories, so admin rows interleave.
const entities = [
  entity('a1', 'A', 'الرئاسة', 'Presidency'),
  entity('b1', 'B', 'وزارة الصحة', 'Health'),
  entity('a2', 'A', 'مجلس الوزراء', 'Cabinet'),
  entity('b2', 'B', 'وزارة التربية', 'Education'),
];

async function renderManager(onReorder = jest.fn()): Promise<{
  onReorder: jest.Mock;
  view: RenderResult;
}> {
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <OfficialEntityManager
          access={fullAccess}
          busy={null}
          categories={categories}
          entities={entities}
          onDelete={jest.fn()}
          onReorder={onReorder}
          onSave={jest.fn()}
          onVisibility={jest.fn()}
        />
      </AppThemeProvider>
    </LocaleProvider>,
  );
  return { onReorder, view };
}

async function pressUpOnRow(view: RenderResult, row: number): Promise<void> {
  const button = view.getAllByLabelText(UP_LABEL)[row];
  if (!button) {
    throw new Error(`row ${row} has no move up control`);
  }
  await fireEvent.press(button);
}

test('moving the second entity of a category up swaps it with the first of that category', async () => {
  const { onReorder, view } = await renderManager();

  await pressUpOnRow(view, 3);

  expect(onReorder).toHaveBeenCalledWith(['b2', 'b1']);
});

test('moving an entity never reorders another category', async () => {
  const { onReorder, view } = await renderManager();

  await pressUpOnRow(view, 2);

  expect(onReorder).toHaveBeenCalledWith(['a2', 'a1']);
});

test('the search field narrows the list and reports filtered and total counts', async () => {
  const { view } = await renderManager();

  expect(view.getByText('عرض 4 من 4 جهة')).toBeTruthy();

  await fireEvent.changeText(
    view.getByLabelText('البحث في الجهات الرسمية'),
    'وزارة',
  );

  expect(view.getByText('عرض 2 من 4 جهة')).toBeTruthy();
  expect(view.queryByText('الرئاسة')).toBeNull();
  // Arrows would look like they skip the siblings the search hides.
  expect(view.queryAllByLabelText(UP_LABEL)).toHaveLength(0);
});

test('the category filter keeps one category and counts every option', async () => {
  const { view } = await renderManager();

  await fireEvent.press(view.getByLabelText('سيادية (2)'));

  expect(view.getByText('عرض 2 من 4 جهة')).toBeTruthy();
  expect(view.getByText('الرئاسة')).toBeTruthy();
  expect(view.queryByText('وزارة الصحة')).toBeNull();
  expect(view.getByLabelText('الكل (4)')).toBeTruthy();
});
