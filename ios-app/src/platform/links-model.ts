export function externalUrl(value: string): string {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('الرابط غير صالح.');
  return url.toString();
}

export function phoneUrl(value: string): string {
  const number = value.replace(/[\s()-]/g, '');
  if (!/^\+?[0-9*#]{1,24}$/.test(number)) throw new Error('رقم الهاتف غير صالح.');
  return `tel:${encodeURIComponent(number)}`;
}

export function emailUrl(value: string): string {
  if (!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value)) throw new Error('البريد الإلكتروني غير صالح.');
  return `mailto:${encodeURIComponent(value)}`;
}
