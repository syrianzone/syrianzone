import { expect, test } from 'bun:test';
import { adminPermission, formPayload } from './admin-contract';
import { phonebookAdmin, phoneFields } from './admin-model';
import { govappsAdmin } from '../GovApps/admin-model';
import { syofficialAdmin } from '../SyOfficial/admin-model';
import { guesswhoAdmin, characterFields } from '../GuessWho/admin-model';

const category = { id: 'emergency', label_ar: 'طوارئ', label_en: 'Emergency', is_active: false, order_column: 0 };
test('Phonebook administration decodes its actual controller props rather than public flattened rows', () => {
  const data = phonebookAdmin.decode({ categories: [category], entries: [{ id: 'one', category_id: category.id, name_ar: 'س', name_en: null, number: '110', is_whatsapp: true, source_url: null, is_active: false, order_column: 2, category }] });
  expect(data.items[0]).toMatchObject({ categoryId: category.id, active: false, values: { is_whatsapp: true, number: '110' } });
  expect(formPayload(phoneFields, { id: '', category_id: category.id, name_ar: 'س', name_en: '', number: '110', is_whatsapp: true, source_url: '', is_active: false }, true)).not.toHaveProperty('id');
});
test('official social platform keys and legacy government app URL lists survive native admin reads', () => {
  const official = syofficialAdmin.decode({ categories: [category], entities: [{ id: 'entity', category_id: category.id, name: 'Entity', name_ar: 'جهة', description: null, description_ar: null, socials: { facebook: 'https://facebook.com/example' }, image: '/storage/e.webp', is_active: true, order_column: 1 }] });
  expect(official.items[0]?.values['socials.facebook']).toBe('https://facebook.com/example');
  const apps = govappsAdmin.decode({ apps: [{ id: 'app', name: 'App', name_ar: 'تطبيق', is_active: true, order_column: 0, links: ['https://example.test/a', 'https://example.test/b'], icon: null }] });
  expect(apps.items[0]?.values['links.0']).toBe('https://example.test/a');
  expect(apps.items[0]?.values['links.1']).toBe('https://example.test/b');
});
test('Guess Who category and character identities, required image path and attributes retain controller shape', () => {
  const data = guesswhoAdmin.decode({ categories: [{ id: 1, name_ar: 'رياضة', name_en: 'Sports', slug: 'sports', is_active: false, characters_count: 1 }], characters: [{ id: 2, category_id: 1, name_ar: 'س', name_en: 'S', image_path: 'guesswho/characters/one.jpg', attributes: { color: 'red', nested: { value: true } }, is_active: false }] });
  const row = data.items[0]!;
  expect(row).toMatchObject({ id: '2', categoryId: '1', active: false, image: 'https://syrian.zone/storage/guesswho/characters/one.jpg' });
  expect(formPayload(characterFields, row.values, false, row.original).attributes).toEqual({ color: 'red', nested: { value: true } });
  expect(guesswhoAdmin.image).toEqual({ field: 'image_file', required: true });
});
test('each native admin action uses its exact server capability without role inference', () => {
  expect(adminPermission(phonebookAdmin, 'toggle')).toBe('phonebook.toggle');
  expect(adminPermission(govappsAdmin, 'reorder')).toBe('govapps.reorder');
  expect(adminPermission(syofficialAdmin, 'edit')).toBe('syofficial.edit');
  expect(adminPermission(guesswhoAdmin, 'delete')).toBe('guesswho.manage');
});
