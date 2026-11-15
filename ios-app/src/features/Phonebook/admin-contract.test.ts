import { expect, test } from 'bun:test';
import { adminAck, appendAdminFields, decodeAdminCategory, decodeAdminRows, fieldErrors, formPayload, orderedMove, type AdminField } from './admin-contract';

const fields: AdminField[] = [
  { key: 'id', label: 'المعرّف', kind: 'id', required: true, max: 64, immutable: true },
  { key: 'name_ar', label: 'الاسم', required: true, max: 255 },
  { key: 'is_active', label: 'ظاهر', kind: 'toggle' },
  { key: 'socials.facebook', label: 'فيسبوك', kind: 'url', max: 2048 }
];
test('admin decoders preserve hidden rows, ordering, inactive categories and source identities', () => {
  expect(decodeAdminCategory({ id: 'emergency', label_ar: 'طوارئ', label_en: 'Emergency', is_active: false, order_column: 2, icon: null })).toMatchObject({ id: 'emergency', active: false, order: 2 });
  const rows = decodeAdminRows([{ id: 'one', name_ar: 'س', is_active: false, order_column: 3, socials: { facebook: 'https://facebook.com/example', new_platform: 'https://example.test' } }], fields);
  expect(rows[0]).toMatchObject({ id: 'one', title: 'س', active: false, order: 3 });
  expect(rows[0]?.values['socials.new_platform']).toBe('https://example.test');
  expect(() => decodeAdminRows([{ id: 'one', is_active: 'false' }], fields)).toThrow();
});
test('admin forms retain platform keys and false values while immutable IDs stay out of update payloads', () => {
  const values = { id: 'one', name_ar: 'س', is_active: false, 'socials.facebook': 'https://facebook.com/example', 'socials.new_platform': 'https://example.test' };
  expect(formPayload(fields, values, false)).toEqual({ name_ar: 'س', is_active: false, socials: { facebook: 'https://facebook.com/example', new_platform: 'https://example.test' } });
  expect(formPayload(fields, values, true)).toHaveProperty('id', 'one');
});
test('field validation rejects unsafe IDs, overlong names and nonweb links before dispatch', () => {
  expect(fieldErrors(fields, { id: '../other', name_ar: '', is_active: true, 'socials.facebook': 'file:///private/photo' }, true)).toEqual({ id: 'المعرّف يحتوي حروفاً وأرقاماً وشرطة فقط.', name_ar: 'هذا الحقل مطلوب.', 'socials.facebook': 'أدخل رابط HTTP أو HTTPS صحيحاً.' });
  expect(fieldErrors(fields, { id: 'one', name_ar: 'س', is_active: false, 'socials.facebook': '' }, true)).toEqual({});
});
test('reordering sends a complete stable permutation and explicit JSON acknowledgement is required', () => {
  expect(orderedMove(['a', 'b', 'c'], 1, -1)).toEqual([{ id: 'b', order_column: 0 }, { id: 'a', order_column: 1 }, { id: 'c', order_column: 2 }]);
  expect(() => orderedMove(['a', 'a'], 0, 1)).toThrow();
  expect(() => adminAck({ success: false })).toThrow(); expect(() => adminAck({ message: 'ok' })).toThrow();
  expect(adminAck({ success: true })).toBeUndefined();
});
test('multipart edits retain platform keys and send explicit empty Guess Who attributes as reviewed JSON', () => {
  const entries: [string, string][] = [];
  appendAdminFields({ append: (key, value) => { entries.push([key, value]); } }, { name_ar: 'س', is_active: false, socials: { facebook: 'https://facebook.com/example', telegram: '' }, attributes: [] });
  expect(entries).toEqual([['name_ar', 'س'], ['is_active', '0'], ['socials[facebook]', 'https://facebook.com/example'], ['socials[telegram]', ''], ['attributes_json', '[]']]);
});
