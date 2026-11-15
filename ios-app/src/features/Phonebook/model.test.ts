import { expect, test } from 'bun:test';
import { decodePhonebook, filterPhonebook, whatsappUrl, callNumber } from './model';

const source = { categories: [{ id: 'emergency', label_ar: 'الطوارئ', label_en: 'Emergency' }], initialData: [{ id: 'police', category_id: 'emergency', category_ar: 'الطوارئ', category_en: 'Emergency', name_ar: 'شرطة دمشق', name_en: 'Damascus police', number: '09 1234 5678', is_whatsapp: true, source_url: 'https://example.test/' }] };
test('decodes source phonebook category identity and preserves number text', () => {
  const page = decodePhonebook(source);
  expect(page.entries[0]?.number).toBe('09 1234 5678');
  expect(page.categories[0]?.id).toBe('emergency');
  expect(filterPhonebook(page.entries, 'شرطه', 'emergency')).toHaveLength(1);
  expect(filterPhonebook(page.entries, '+(09)-1234', '')).toHaveLength(1);
  expect(filterPhonebook(page.entries, '', 'other')).toHaveLength(0);
});
test('uses source Syrian WhatsApp normalization without changing international numbers', () => {
  expect(whatsappUrl('09 1234 5678')).toBe('https://wa.me/963912345678');
  expect(whatsappUrl('00963 (912) 345-678')).toBe('https://wa.me/963912345678');
  expect(whatsappUrl('+44 7911 123456')).toBe('https://wa.me/447911123456');
  expect(callNumber('+963 (11) 123-456')).toBe('+96311123456');
  expect(() => whatsappUrl('javascript:alert(1)')).toThrow();
});
test('rejects malformed phone rows and unsafe source schemes', () => {
  expect(() => decodePhonebook({ ...source, initialData: [{ ...source.initialData[0], is_whatsapp: 'true' }] })).toThrow();
  expect(() => decodePhonebook({ ...source, initialData: [{ ...source.initialData[0], source_url: 'javascript:alert(1)' }] })).toThrow();
});
test('matches trimmed queries and keeps short service codes before regular numbers', () => {
  const entry = decodePhonebook(source).entries[0]!;
  const entries = [{ ...entry, id: 'regular-first', number: '0112223334' }, { ...entry, id: 'service-one', number: '113' }, { ...entry, id: 'service-two', number: '110' }, { ...entry, id: 'regular-last', number: '+963112222222' }];
  expect(filterPhonebook(entries, '  شرطه  ', '').map(item => item.id)).toEqual(['service-one', 'service-two', 'regular-first', 'regular-last']);
  expect(entries[0]?.id).toBe('regular-first');
});
test('derives the source category vocabulary when the cached page omits categories', () => {
  const page = decodePhonebook({ initialData: [{ ...source.initialData[0], category_id: 'legacy-uuid' }] });
  expect(page.categories).toEqual([{ id: 'emergency', labelAr: 'الطوارئ', labelEn: 'Emergency' }]);
  expect(filterPhonebook(page.entries, '', 'emergency')).toHaveLength(1);
  expect(page.entries[0]?.categoryId).toBe('emergency');
});
