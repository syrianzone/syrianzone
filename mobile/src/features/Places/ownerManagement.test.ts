import type { PlaceDetail } from './_lib/types';
import {
  ownerDetailsPatch,
  validateOwnerLocation,
} from './ownerManagement';

const place: PlaceDetail = {
  category: 'historical',
  created_at: '2026-07-18T10:00:00Z',
  description: 'وصف تاريخي واضح للمكان يزيد عن عشرين حرفاً.',
  id: 7,
  lat: 33.5,
  lng: 36.3,
  name: 'خان قديم',
  photos: [],
  saved_by_me: false,
  saves_count: 2,
  status: 'approved',
  thumb_url: null,
  user: { avatar_url: null, id: 3, level: 2, name: 'ليلى', points: 37 },
};

describe('owner place management', () => {
  test('returns only changed and trimmed detail fields', () => {
    expect(ownerDetailsPatch(place, {
      category: 'food',
      description: `  ${place.description}  `,
      name: '  مطبخ دمشقي  ',
    })).toEqual({
      category: 'food',
      name: 'مطبخ دمشقي',
    });
    expect(ownerDetailsPatch(place, {
      category: place.category,
      description: place.description,
      name: place.name,
    })).toEqual({});
  });

  test('rejects invalid owner detail fields before a request', () => {
    expect(ownerDetailsPatch(place, {
      category: place.category,
      description: place.description,
      name: '   ',
    })).toBe('أدخل اسم المكان، بحد أقصى 160 حرفاً.');
    expect(ownerDetailsPatch(place, {
      category: place.category,
      description: 'قصير',
      name: place.name,
    })).toBe('الوصف يجب أن يكون بين 20 و1000 حرف.');
  });

  test('parses Syria coordinates and rejects malformed or outside points', () => {
    expect(validateOwnerLocation('34.73941, 36.67507')).toEqual({
      lat: 34.73941,
      lng: 36.67507,
    });
    expect(validateOwnerLocation('دمشق')).toBe('صيغة الإحداثيات غير صحيحة.');
    expect(validateOwnerLocation('40, 36')).toBe('الإحداثيات خارج حدود سوريا.');
  });
});
