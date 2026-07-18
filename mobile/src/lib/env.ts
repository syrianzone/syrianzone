const defaultApiOrigin = 'https://syrian.zone';

export function resolveApiOrigin(value = process.env.EXPO_PUBLIC_API_URL): string {
  const candidate = value?.trim() || defaultApiOrigin;
  const url = new URL(candidate);

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('EXPO_PUBLIC_API_URL must use http or https');
  }

  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export const apiOrigin = resolveApiOrigin();
