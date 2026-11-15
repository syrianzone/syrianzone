import { expect, test } from 'bun:test';
import {
  decodeNavigation,
  editItem,
  moveItem,
  newItem,
  newSubcategory,
  removeItem,
  toggleItem,
} from './model';
test('navigation preserves hidden fields and separate navbar order while editing and reordering', () => {
  const a = {
    ...newItem('a'),
    id: 'a',
    title: 'قسم',
    text: 'قسم',
    future: { enabled: true },
    isCustom: false,
  };
  let config = decodeNavigation({
    navbarTopCount: 5,
    useSeparateNavbarOrder: true,
    navbarOrder: ['b', 'a'],
    items: [a, { ...newItem('b'), id: 'b' }],
    version: 2,
  });
  config = moveItem(config, 'a', 1);
  expect(config.items.map((item) => item.id)).toEqual(['b', 'a']);
  expect(config.navbarOrder).toEqual(['b', 'a']);
  config = toggleItem(config, 'a', false);
  expect(config.items[1]).toMatchObject({
    enabled: false,
    showOnHome: false,
    showInNavbar: false,
    future: { enabled: true },
  });
  config = toggleItem(config, 'a', true);
  expect(config.items[1]).toMatchObject({ enabled: true, showOnHome: true, showInNavbar: true });
  expect(() => removeItem(config, 'a')).toThrow();
  const custom = {
    ...newItem('x'),
    id: 'custom',
    title: 'مخصص',
    href: '/custom',
    subCategories: [{ ...newSubcategory(a, 0), title: 'فرعي', target: 'kept' }],
  };
  config = editItem(config, null, custom);
  expect(config.navbarOrder).toEqual(['b', 'a', 'custom']);
  expect(config.items[2]?.subCategories[0]?.target).toBe('kept');
  expect(removeItem(config, 'custom').items).toHaveLength(2);
  expect(() => editItem(config, 'a', { ...a, id: 'renamed' })).toThrow();
  expect(() => editItem(config, null, { ...custom, id: 'b' })).toThrow();
});
test('navigation shared ordering follows the items and rejects invalid staged edits without loss', () => {
  const a = { ...newItem('a'), id: 'a', title: 'قسم', href: '/a' },
    b = { ...newItem('b'), id: 'b', title: 'آخر', href: '/b' };
  const config = decodeNavigation({
    items: [a, b],
    navbarTopCount: 5,
    useSeparateNavbarOrder: false,
    navbarOrder: ['a', 'b'],
  });
  expect(moveItem(config, 'a', 1).navbarOrder).toEqual(['b', 'a']);
  expect(() => editItem(config, 'a', { ...a, href: 'javascript:alert(1)' })).toThrow();
  expect(config.items[0]?.href).toBe('/a');
});
