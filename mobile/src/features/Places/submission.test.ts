import type { PlacePhotoUpload } from './_lib/submission';
import {
  mergePickedPhotos,
  validatePlaceSubmission,
} from './_lib/submission';

const photo = (overrides: Partial<{
  fileName: string | null;
  fileSize: number;
  mimeType: string | null;
  uri: string;
  width: number;
  height: number;
}> = {}) => ({
  fileName: 'damascus.jpg',
  fileSize: 1_000_000,
  height: 1200,
  mimeType: 'image/jpeg',
  uri: 'file:///damascus.jpg',
  width: 1600,
  ...overrides,
});

describe('place submission validation', () => {
  test('enforces source name, description, category, and photo bounds', () => {
    const validPhotos: PlacePhotoUpload[] = [
      {
        fileName: 'damascus.jpg',
        fileSize: 1_000_000,
        mimeType: 'image/jpeg',
        uri: 'file:///damascus.jpg',
      },
    ];

    expect(
      validatePlaceSubmission({
        category: 'historical',
        description: 'وصف واضح للمكان يزيد عن عشرين حرفاً.',
        name: 'خان أسعد باشا',
        photos: validPhotos,
      }),
    ).toBeNull();
    expect(
      validatePlaceSubmission({
        category: 'historical',
        description: 'قصير',
        name: 'خان',
        photos: validPhotos,
      }),
    ).toBe('الوصف يجب أن يكون بين 20 و1000 حرف.');
    expect(
      validatePlaceSubmission({
        category: null,
        description: 'وصف واضح للمكان يزيد عن عشرين حرفاً.',
        name: 'خان',
        photos: validPhotos,
      }),
    ).toBe('اختر تصنيف المكان.');
    expect(
      validatePlaceSubmission({
        category: 'historical',
        description: 'وصف واضح للمكان يزيد عن عشرين حرفاً.',
        name: 'خان',
        photos: [],
      }),
    ).toBe('أضف من صورة واحدة إلى 10 صور.');
  });

  test('accepts only ten JPEG, PNG, or WebP files no larger than 12 MB', () => {
    const result = mergePickedPhotos(
      [],
      [
        photo(),
        photo({ fileName: 'aleppo.png', mimeType: 'image/png', uri: 'file:///aleppo.png' }),
        photo({ fileName: 'hama.webp', mimeType: 'image/webp', uri: 'file:///hama.webp' }),
        photo({ fileName: 'bad.gif', mimeType: 'image/gif', uri: 'file:///bad.gif' }),
        photo({ fileName: 'large.jpg', fileSize: 12 * 1024 * 1024 + 1, uri: 'file:///large.jpg' }),
        photo({ fileName: 'small.jpg', height: 199, uri: 'file:///small.jpg' }),
        photo({ fileName: 'wide.jpg', uri: 'file:///wide.jpg', width: 6001 }),
      ],
    );

    expect(result.photos).toHaveLength(3);
    expect(result.errors).toEqual([
      'الصورة bad.gif ليست بصيغة JPEG أو PNG أو WebP.',
      'الصورة large.jpg تتجاوز 12 ميغابايت.',
      'الصورة small.jpg أصغر من 200x200 بكسل.',
      'الصورة wide.jpg تتجاوز 6000x6000 بكسل.',
    ]);

    const atLimit = mergePickedPhotos(
      result.photos,
      Array.from({ length: 9 }, (_, index) =>
        photo({ fileName: `extra-${index}.jpg`, uri: `file:///extra-${index}.jpg` }),
      ),
    );
    expect(atLimit.photos).toHaveLength(10);
    expect(atLimit.errors).toContain('الحد الأقصى 10 صور.');
  });

  test('infers a safe upload name and MIME type when the picker omits them', () => {
    const result = mergePickedPhotos([], [
      photo({ fileName: null, mimeType: null, uri: 'file:///picked/image.webp' }),
    ]);

    expect(result).toEqual({
      errors: [],
      photos: [
        {
          fileName: 'image.webp',
          fileSize: 1_000_000,
          mimeType: 'image/webp',
          uri: 'file:///picked/image.webp',
        },
      ],
    });
  });
});
