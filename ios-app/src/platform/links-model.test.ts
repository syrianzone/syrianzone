import { expect, test } from 'bun:test';
import { emailUrl, externalUrl, phoneUrl } from './links-model';

test('opens only web URLs and rejects injected native schemes', () => {
  expect(externalUrl('https://example.com/a')).toBe('https://example.com/a');
  for (const value of ['tel:123', 'javascript:alert(1)', 'https://user:pass@example.com']) expect(() => externalUrl(value)).toThrow();
});
test('encodes phone service codes and prevents mail header injection', () => {
  expect(phoneUrl('*123#')).toBe('tel:*123%23');
  expect(phoneUrl('+963 (11) 123')).toBe('tel:%2B96311123');
  expect(emailUrl('hi@example.com')).toBe('mailto:hi%40example.com');
  expect(() => emailUrl('hi@example.com?bcc=someone')).toThrow();
});
