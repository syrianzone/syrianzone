import type { PlaceReportReason } from './types';

export const REPORT_REASONS: { key: PlaceReportReason; label: string }[] = [
  { key: 'inappropriate', label: 'محتوى مسيء أو غير لائق' },
  { key: 'spam', label: 'محتوى مزعج أو إعلاني' },
  { key: 'wrong_info', label: 'معلومات خاطئة' },
  { key: 'duplicate', label: 'مكان مكرر' },
  { key: 'other', label: 'سبب آخر' },
];

export const REPORT_REASON_LABELS = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.key, r.label]),
) as Record<PlaceReportReason, string>;
