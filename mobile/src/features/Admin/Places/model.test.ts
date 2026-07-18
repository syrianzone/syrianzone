import {
  canModeratePlaces,
  placeModerationStatusLabel,
  validatePlaceEdit,
} from './model';

describe('place moderation model', () => {
  test('gates moderation to general administrators', () => {
    expect(canModeratePlaces('admin')).toBe(true);
    expect(canModeratePlaces('superadmin')).toBe(true);
    expect(canModeratePlaces('transit_admin')).toBe(false);
    expect(canModeratePlaces('user')).toBe(false);
  });

  test('labels every place lifecycle state', () => {
    expect(placeModerationStatusLabel('pending')).toBe('قيد المراجعة');
    expect(placeModerationStatusLabel('approved')).toBe('مقبول');
    expect(placeModerationStatusLabel('rejected')).toBe('مرفوض');
    expect(placeModerationStatusLabel('all')).toBe('الكل');
  });

  test('validates complete place edits against the server rules', () => {
    const valid = {
      category: 'historical' as const,
      description: 'وصف مفصل للمكان يتجاوز عشرين حرفاً',
      lat: '33.5138',
      lng: '36.2765',
      name: 'خان أسعد باشا',
    };

    expect(validatePlaceEdit(valid)).toEqual({
      category: 'historical',
      description: valid.description,
      lat: 33.5138,
      lng: 36.2765,
      name: valid.name,
    });
    expect(validatePlaceEdit({ ...valid, lat: '31.9' })).toBe(
      'الإحداثيات خارج حدود سوريا',
    );
    expect(validatePlaceEdit({ ...valid, description: 'قصير' })).toBe(
      'الوصف يجب أن يكون بين 20 و1000 حرف.',
    );
  });

  test('trims text and enforces every text boundary', () => {
    const base = {
      category: 'natural' as const,
      description: `  ${'د'.repeat(20)}  `,
      lat: '32',
      lng: '35.5',
      name: '  مكان  ',
    };

    expect(validatePlaceEdit(base)).toEqual({
      ...base,
      description: 'د'.repeat(20),
      lat: 32,
      lng: 35.5,
      name: 'مكان',
    });
    expect(validatePlaceEdit({ ...base, name: '   ' })).toContain('اسم المكان');
    expect(validatePlaceEdit({ ...base, name: 'ن'.repeat(161) })).toContain('اسم المكان');
    expect(validatePlaceEdit({ ...base, name: 'ن'.repeat(160) })).not.toEqual(
      expect.any(String),
    );
    expect(validatePlaceEdit({ ...base, description: 'د'.repeat(19) })).toContain(
      'بين 20 و1000',
    );
    expect(validatePlaceEdit({ ...base, description: 'د'.repeat(1000) })).not.toEqual(
      expect.any(String),
    );
    expect(validatePlaceEdit({ ...base, description: 'د'.repeat(1001) })).toContain(
      'بين 20 و1000',
    );
  });

  test.each([
    ['NaN', '36'],
    ['33', 'Infinity'],
    ['31.999', '36'],
    ['37.501', '36'],
    ['33', '35.499'],
    ['33', '42.501'],
  ])('rejects invalid coordinate pair %s, %s', (lat, lng) => {
    expect(
      validatePlaceEdit({
        category: 'other',
        description: 'د'.repeat(20),
        lat,
        lng,
        name: 'مكان',
      }),
    ).toBe('الإحداثيات خارج حدود سوريا');
  });

  test.each([
    ['32', '35.5'],
    ['37.5', '42.5'],
  ])('accepts server coordinate boundary %s, %s', (lat, lng) => {
    expect(
      validatePlaceEdit({
        category: 'other',
        description: 'د'.repeat(20),
        lat,
        lng,
        name: 'مكان',
      }),
    ).toEqual(expect.objectContaining({ lat: Number(lat), lng: Number(lng) }));
  });
});
