import type {
  LatLng,
  PlaceCategory,
  PlaceDetail,
} from './_lib/types';
import { isPointInSyria, parseLatLng } from './model';

interface OwnerDetailFields {
  category: PlaceCategory;
  description: string;
  name: string;
}

type OwnerDetailsPatch = Partial<OwnerDetailFields>;

export function ownerDetailsPatch(
  place: PlaceDetail,
  fields: OwnerDetailFields,
): OwnerDetailsPatch | string {
  const name = fields.name.trim();
  if (name.length === 0 || name.length > 160) {
    return 'أدخل اسم المكان، بحد أقصى 160 حرفاً.';
  }
  const description = fields.description.trim();
  if (description.length < 20 || description.length > 1000) {
    return 'الوصف يجب أن يكون بين 20 و1000 حرف.';
  }

  const patch: OwnerDetailsPatch = {};
  if (name !== place.name) {
    patch.name = name;
  }
  if (fields.category !== place.category) {
    patch.category = fields.category;
  }
  if (description !== place.description) {
    patch.description = description;
  }
  return patch;
}

export function validateOwnerLocation(value: string): LatLng | string {
  const point = parseLatLng(value.trim());
  if (!point) {
    return 'صيغة الإحداثيات غير صحيحة.';
  }
  if (!isPointInSyria(point)) {
    return 'الإحداثيات خارج حدود سوريا.';
  }
  return point;
}
