import { decodeAccountUser, type AccountUser } from './account-model';
import { record, text } from './validation';

export interface MobileSession { token: string; user: AccountUser; expiresAt: string | null }
export function decodeMobileSession(value: unknown): MobileSession {
  const row = record(value), token = text(row.token);
  if (!/^[\x21-\x7e]{16,512}$/.test(token) || row.token_type !== 'Bearer' || row.expires_at !== null && (typeof row.expires_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(row.expires_at) || !Number.isFinite(Date.parse(row.expires_at))))
    throw new Error('لم يكتمل التحقق من تسجيل الدخول.');
  return { token, user: decodeAccountUser(row.user), expiresAt: row.expires_at as string | null };
}
export function superadminCredentials(email: string, password: string): { email: string; password: string; device_name: string } {
  if (!/^[^\s@]+@[^\s@]+$/.test(email.trim())) throw new Error('أدخل بريداً إلكترونياً صالحاً.');
  if (/^[ \t\n\r\u0000\u000b]*$/.test(password)) throw new Error('أدخل كلمة المرور.');
  return { email: email.trim(), password, device_name: 'Syrian Zone iOS' };
}
