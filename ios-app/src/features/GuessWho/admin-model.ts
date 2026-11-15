import { record } from '../../platform/validation';
import { decodeAdminRows, type AdminDefinition, type AdminField } from '../../platform/directory-admin/admin-contract';

export const guessCategoryFields: readonly AdminField[] = [
  { key: 'name_ar', label: 'الاسم بالعربية', required: true, max: 255 }, { key: 'name_en', label: 'الاسم بالإنجليزية', required: true, max: 255 },
  { key: 'slug', label: 'المعرّف الفريد للفئة', kind: 'id', required: true, max: 255 }, { key: 'is_active', label: 'فئة مفعّلة', kind: 'toggle' }
];
export const characterFields: readonly AdminField[] = [
  { key: 'category_id', label: 'الفئة', kind: 'category', required: true },
  { key: 'name_ar', label: 'الاسم بالعربية', required: true, max: 255 }, { key: 'name_en', label: 'الاسم بالإنجليزية', required: true, max: 255 },
  { key: 'attributes', label: 'السمات، كل سطر: الاسم: القيمة', kind: 'attributes' }, { key: 'is_active', label: 'شخصية مفعّلة', kind: 'toggle' }
];
export const guesswhoAdmin: AdminDefinition = {
  key: 'guesswho', title: 'إدارة لعبة من هو', component: 'Admin/GuessWho/Index', itemPath: 'characters', categories: true,
  itemFields: characterFields, categoryFields: guessCategoryFields, image: { field: 'image_file', required: true }, reorder: false, toggle: false,
  decode(value) { const page = record(value); return { categories: decodeAdminRows(page.categories, guessCategoryFields), items: decodeAdminRows(page.characters, characterFields, { imageKey: 'image_path', storageImage: true }) }; }
};
// PORT STATUS: source Admin/GuessWho/Index.tsx,_components/{CategoryDialog,CharacterDialog}.tsx and GuessWhoAdminController.php; confidence high; todos 0.
