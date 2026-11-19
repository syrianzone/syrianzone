export function canonicalHttpsOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('عنوان المنصة غير صالح.');
  return url.origin;
}

export const configuredSiteOrigin = canonicalHttpsOrigin(process.env.EXPO_PUBLIC_API_ORIGIN ?? 'https://syrian.zone');
