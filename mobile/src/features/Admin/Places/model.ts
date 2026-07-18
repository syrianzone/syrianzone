import type {
  PlaceCategory,
  PlaceStatus,
} from '@/features/Places/_lib/types';

export type PlaceModerationStatus = PlaceStatus | 'all';

interface PlaceEditInput {
  category: PlaceCategory;
  description: string;
  lat: string;
  lng: string;
  name: string;
}

export interface PlaceEditValues {
  category: PlaceCategory;
  description: string;
  lat: number;
  lng: number;
  name: string;
}

export function canModeratePlaces(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function placeModerationStatusLabel(
  status: PlaceModerationStatus,
): string {
  switch (status) {
    case 'pending':
      return 'قيد المراجعة';
    case 'approved':
      return 'مقبول';
    case 'rejected':
      return 'مرفوض';
    default:
      return 'الكل';
  }
}

export function validatePlaceEdit(
  input: PlaceEditInput,
): PlaceEditValues | string {
  const name = input.name.trim();
  if (name.length === 0 || name.length > 160) {
    return 'أدخل اسم المكان، بحد أقصى 160 حرفاً.';
  }
  const description = input.description.trim();
  if (description.length < 20 || description.length > 1000) {
    return 'الوصف يجب أن يكون بين 20 و1000 حرف.';
  }
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 32 ||
    lat > 37.5 ||
    lng < 35.5 ||
    lng > 42.5
  ) {
    return 'الإحداثيات خارج حدود سوريا';
  }
  return { category: input.category, description, lat, lng, name };
}
