const SHEET = '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc';

export function externalReadUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port) throw new Error('External provider URL is invalid');
  const valid = (url.hostname === 'ipwho.is' && url.pathname === '/') ||
    (url.hostname === 'docs.google.com' && url.pathname === `/spreadsheets/d/${SHEET}/export` && url.searchParams.get('format') === 'csv' && /^\d+$/.test(url.searchParams.get('gid') ?? '')) ||
    (url.hostname === 'api-staging.mp3quran.net' && /^\/v4\/(?:surahs(?:\/(?:[1-9]\d?|10\d|11[0-4])\/text)?|recitations\/[a-z0-9_-]{1,80}\/r[123]\/surahs\/(?:[1-9]\d?|10\d|11[0-4])(?:\/(?:ayah-timings|word-timings|letter-timings))?)$/.test(url.pathname));
  if (!valid) throw new Error('External provider is not supported');
  return url;
}

export function acceptsExternalResponse(request: URL, value: string): boolean {
  if (!value) return true;
  const response = new URL(value);
  if (response.protocol !== 'https:' || response.username || response.password) return false;
  if (response.origin === request.origin && response.pathname === request.pathname) return true;
  // Google's public CSV export redirects to a short-lived, credential-free download host.
  return request.hostname === 'docs.google.com' && /^(?:doc-[a-z0-9-]+-sheets|docs)\.googleusercontent\.com$/.test(response.hostname);
}
