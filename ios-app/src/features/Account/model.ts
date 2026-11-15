import { record } from '../../platform/validation';
export function profileErrors(name: string, email: string): Partial<Record<'name' | 'email', string>> {
  const errors: Partial<Record<'name' | 'email', string>> = {};
  if (!name.trim()) errors.name = 'اكتب الاسم.'; else if (name.trim().length > 255) errors.name = 'الاسم يجب ألا يتجاوز ٢٥٥ حرفاً.';
  if (!email.trim()) errors.email = 'اكتب البريد الإلكتروني.'; else if (email.trim().length > 255 || !/^[^\s@]+@[^\s@]+$/.test(email.trim())) errors.email = 'أدخل بريداً إلكترونياً صالحاً.';
  return errors;
}
export function confirmedAccountDelete(value: unknown): void { if (record(value).ok !== true) throw new Error('لم يتم تأكيد حذف الحساب.'); }
export const avatarBounds = { maxBytes: 4 * 1024 * 1024, minWidth: 64, minHeight: 64, maxWidth: 6000, maxHeight: 6000 } as const;

// PORT STATUS: source app/Http/Controllers/DashboardController.php; confidence high; todos 0.
