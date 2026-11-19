import { expect, test } from 'bun:test';
import { createDocumentStore } from './document-store';
import { record, text, assetUrl } from './validation';

test('round trips source documents and distinguishes absent data from corrupt data', async () => {
  const values = new Map<string, string>();
  const store = createDocumentStore({ getItemAsync: async key => values.get(key) ?? null, setItemAsync: async (key, value) => { values.set(key, value); } });
  const decode = (value: unknown): string => text(record(value).name);
  expect(await store.read('home', decode, 'empty')).toBe('empty');
  await store.write('home', { name: 'دمشق' });
  expect(await store.read('home', decode, 'empty')).toBe('دمشق');
  await store.write('home', { name: false });
  await expect(store.read('home', decode, 'empty')).rejects.toThrow('لم يتم تغييرها');
  expect(values.get('syrian-zone.document.home')).toBe('{"name":false}');
});

test('rejects unsafe asset URLs and preserves trusted relative paths', () => {
  expect(assetUrl('/assets/map.svg')).toBe('https://syrian.zone/assets/map.svg');
  expect(assetUrl('https://cdn.example.com/image.png')).toBe('https://cdn.example.com/image.png');
  for (const value of ['javascript:alert(1)', '//evil.example/a', 'https://user:pass@example.com/a', 'file:///a']) expect(() => assetUrl(value)).toThrow();
});
