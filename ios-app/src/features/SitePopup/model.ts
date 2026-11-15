import { integer, record, text } from '../../platform/validation';
export interface SitePopup {
  enabled: boolean;
  title: string;
  description: string;
  buttonText: string;
  dismissText: string;
  link: string;
  version: number;
}
export function decodePopup(value: unknown): SitePopup {
  const row = record(value),
    version = integer(row.version);
  if (typeof row.enabled !== 'boolean' || version < 0) throw new Error('إعدادات النافذة غير صالحة.');
  return {
    enabled: row.enabled,
    title: text(row.title),
    description: text(row.description),
    buttonText: text(row.buttonText),
    dismissText: text(row.dismissText),
    link: text(row.link),
    version,
  };
}
export function committedPopup(value: unknown): SitePopup {
  const row = record(value);
  if (row.success !== true) throw new Error('لم يتم تأكيد الحفظ.');
  return decodePopup(row.popup);
}
export function popupErrors(value: SitePopup): string[] {
  const errors: string[] = [];
  for (const [field, max, message] of [
    ['title', 100, 'اكتب عنواناً من ١ إلى ١٠٠ حرف.'],
    ['description', 500, 'اكتب وصفاً من ١ إلى ٥٠٠ حرف.'],
    ['buttonText', 50, 'اكتب نص الزر من ١ إلى ٥٠ حرفاً.'],
    ['dismissText', 50, 'اكتب نص الإغلاق من ١ إلى ٥٠ حرفاً.'],
  ] as const)
    if (!value[field].trim() || value[field].length > max) errors.push(message);
  try {
    const url = new URL(value.link);
    if (url.protocol !== 'https:' || url.username || url.password || value.link.length > 2048)
      throw new Error();
  } catch {
    errors.push('استخدم رابط HTTPS صالحاً حتى ٢٠٤٨ حرفاً.');
  }
  return errors;
}
