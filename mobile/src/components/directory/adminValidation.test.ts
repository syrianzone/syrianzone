import {
  cleanOptionalText,
  safeDirectoryId,
  safeOptionalHttpUrl,
} from './adminValidation';

test('accepts only server-compatible directory identifiers', () => {
  expect(safeDirectoryId(' ministry_1 ')).toBe('ministry_1');
  expect(() => safeDirectoryId('not safe/id')).toThrow(
    'استخدم أحرفاً وأرقاماً وشرطات فقط.',
  );
});

test('normalizes optional text and rejects unsafe external URLs', () => {
  expect(cleanOptionalText('  بيان رسمي  ')).toBe('بيان رسمي');
  expect(cleanOptionalText('   ')).toBeNull();
  expect(safeOptionalHttpUrl(' https://example.com/path ')).toBe(
    'https://example.com/path',
  );
  expect(() => safeOptionalHttpUrl('javascript:alert(1)')).toThrow(
    'أدخل رابطاً يبدأ بـ http أو https.',
  );
});
