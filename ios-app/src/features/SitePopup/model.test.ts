import { expect, test } from 'bun:test';
import defaults from '../../../../resources/data/site-popup.json';
import { committedPopup, decodePopup, popupErrors } from './model';
test('announcement saves only accept a confirmed committed server version and validate all source fields', () => {
  expect(decodePopup(defaults)).toEqual(defaults);
  expect(committedPopup({ success: true, popup: { ...defaults, version: 8 } }).version).toBe(8);
  expect(() => committedPopup({ success: false, popup: defaults })).toThrow();
  expect(() => decodePopup({ ...defaults, version: -1 })).toThrow();
  expect(
    popupErrors({ ...defaults, link: 'http://example.org', title: ' ', description: 'x'.repeat(501) }),
  ).toEqual([
    'اكتب عنواناً من ١ إلى ١٠٠ حرف.',
    'اكتب وصفاً من ١ إلى ٥٠٠ حرف.',
    'استخدم رابط HTTPS صالحاً حتى ٢٠٤٨ حرفاً.',
  ]);
});
