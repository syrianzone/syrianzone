import { record } from '../../platform/validation';
import { decodeAdminRows, type AdminDefinition, type AdminField } from '../../platform/directory-admin/admin-contract';

export const appFields: readonly AdminField[] = [
  { key: 'id', label: 'معرّف التطبيق', kind: 'id', max: 128, immutable: true, required: true },
  { key: 'name_ar', label: 'الاسم بالعربية', required: true, max: 255 }, { key: 'name', label: 'الاسم بالإنجليزية', required: true, max: 255 },
  { key: 'description_ar', label: 'الوصف بالعربية', kind: 'multiline' }, { key: 'description', label: 'الوصف بالإنجليزية', kind: 'multiline' },
  { key: 'links.official', label: 'الموقع الرسمي', kind: 'url', max: 2048 }, { key: 'links.android', label: 'رابط أندرويد', kind: 'url', max: 2048 },
  { key: 'links.apple', label: 'رابط App Store', kind: 'url', max: 2048 }, { key: 'is_active', label: 'ظاهر في الدليل', kind: 'toggle' }
];
export const govappsAdmin: AdminDefinition = {
  key: 'govapps', title: 'إدارة التطبيقات الحكومية', component: 'Admin/GovApps/Index', itemPath: '', categories: false,
  itemFields: appFields, categoryFields: [], image: { field: 'icon_file', required: false }, reorder: true, toggle: false,
  decode(value) { return { categories: [], items: decodeAdminRows(record(value).apps, appFields, { imageKey: 'icon' }) }; }
};
// PORT STATUS: source Admin/GovApps/Index.tsx,_components/AppDialog.tsx and GovAppsAdminController.php; confidence high; todos 0.
