import { array, record } from '../../platform/validation';
import { categoryFields, decodeAdminCategory, decodeAdminRows, type AdminDefinition, type AdminField } from './admin-contract';

export const phoneFields: readonly AdminField[] = [
  { key: 'id', label: 'معرّف الرقم (اختياري عند الإنشاء)', kind: 'id', max: 128, immutable: true },
  { key: 'category_id', label: 'الفئة', kind: 'category', required: true },
  { key: 'name_ar', label: 'الاسم بالعربية', required: true, max: 255 }, { key: 'name_en', label: 'الاسم بالإنجليزية', max: 255 },
  { key: 'number', label: 'رقم الهاتف', required: true, max: 64 }, { key: 'is_whatsapp', label: 'الرقم متاح على واتساب', kind: 'toggle' },
  { key: 'source_url', label: 'رابط المصدر', kind: 'url', max: 500 }, { key: 'is_active', label: 'ظاهر في الدليل', kind: 'toggle' }
];
export const phonebookAdmin: AdminDefinition = {
  key: 'phonebook', title: 'إدارة دليل الهاتف والواتساب', component: 'Admin/Phonebook/Index', itemPath: 'entries', categories: true,
  itemFields: phoneFields, categoryFields, reorder: true, toggle: true,
  decode(value) { const page = record(value); return { categories: array(page.categories).map(decodeAdminCategory), items: decodeAdminRows(page.entries, phoneFields) }; }
};
// PORT STATUS: source Admin/Phonebook/Index.tsx and PhonebookAdminController.php; confidence high; todos 0.
