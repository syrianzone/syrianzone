import { expect, test } from 'bun:test';
import { decodeInformation } from './information-model';
test('native document model keeps content as text and rejects unsafe image and link schemes', () => {
  const source = { title: 'سياسة', subtitle: 'تاريخ', sections: [{ title: 'حساب', subtitle: '', blocks: [{ kind: 'paragraph', text: '<script>plain text</script>', href: '', src: '' }, { kind: 'link', text: 'الحساب', href: '/dashboard', src: '' }] }], footer: [] };
  expect(decodeInformation(source).sections[0]?.blocks[0]?.text).toBe('<script>plain text</script>');
  expect(decodeInformation(source).sections[0]?.blocks[1]?.href).toBe('/dashboard');
  expect(() => decodeInformation({ ...source, footer: [{ kind: 'link', text: 'x', href: 'javascript:alert(1)', src: '' }] })).toThrow();
  expect(() => decodeInformation({ ...source, footer: [{ kind: 'image', text: 'x', href: '', src: 'file:///private/data' }] })).toThrow();
});
