import { array, record } from '../../platform/validation';
import vocabulary from '../../../../resources/data/social-platforms.json';
import { categoryFields, decodeAdminCategory, decodeAdminRows, type AdminDefinition, type AdminField } from '../../platform/directory-admin/admin-contract';

export const officialFields: readonly AdminField[] = [
  { key: 'id', label: 'معرّف الجهة', kind: 'id', max: 128, immutable: true, required: true },
  { key: 'category_id', label: 'الفئة', kind: 'category', required: true },
  { key: 'name_ar', label: 'الاسم بالعربية', required: true, max: 255 }, { key: 'name', label: 'الاسم بالإنجليزية', required: true, max: 255 },
  { key: 'description_ar', label: 'الوصف بالعربية', kind: 'multiline' }, { key: 'description', label: 'الوصف بالإنجليزية', kind: 'multiline' },
  ...vocabulary.map(platform => ({ key: `socials.${platform.key}`, label: platform.form_label_ar, kind: 'url' as const, max: 2048 })),
  { key: 'is_active', label: 'ظاهرة في الدليل', kind: 'toggle' }
];
export const syofficialAdmin: AdminDefinition = {
  key: 'syofficial', title: 'إدارة الحسابات الرسمية', component: 'Admin/SyOfficial/Index', itemPath: 'entities', categories: true,
  itemFields: officialFields, categoryFields, image: { field: 'image_file', required: false }, reorder: true, toggle: false,
  decode(value) { const page = record(value); return { categories: array(page.categories).map(decodeAdminCategory), items: decodeAdminRows(page.entities, officialFields, { imageKey: 'image' }) }; }
};
// PORT STATUS: source Admin/SyOfficial/Index.tsx,_components/EntityDialog.tsx and SyOfficialAdminController.php; confidence high; todos 0.
