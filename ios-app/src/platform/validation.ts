export function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('بيانات غير صالحة.');
  return value as Record<string, unknown>;
}

export function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('قائمة غير صالحة.');
  return value;
}

export function text(value: unknown, fallback?: string): string {
  if (value == null && fallback !== undefined) return fallback;
  if (typeof value !== 'string') throw new Error('نص غير صالح.');
  return value;
}

export function finiteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('رقم غير صالح.');
  return value;
}

export function integer(value: unknown): number {
  const result = finiteNumber(value);
  if (!Number.isSafeInteger(result)) throw new Error('رقم غير صالح.');
  return result;
}

export function assetUrl(value: unknown, origin = configuredSiteOrigin): string | null {
  if (value == null || value === '') return null;
  const path = text(value);
  if (path.startsWith('//') || path.includes('\\')) throw new Error('رابط غير صالح.');
  const url = new URL(path, origin);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('رابط غير صالح.');
  return url.toString();
}
import { configuredSiteOrigin } from './site-origin';

