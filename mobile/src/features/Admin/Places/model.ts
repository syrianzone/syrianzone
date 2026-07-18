import type { PlaceStatus } from '@/features/Places/_lib/types';

export type PlaceModerationStatus = PlaceStatus | 'all';
export type ReportModerationStatus = 'open' | 'resolved' | 'dismissed' | 'all';

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

export function reportModerationStatusLabel(
  status: ReportModerationStatus,
): string {
  switch (status) {
    case 'open':
      return 'مفتوح';
    case 'resolved':
      return 'تمت المعالجة';
    case 'dismissed':
      return 'مرفوض';
    default:
      return 'الكل';
  }
}
