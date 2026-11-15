// Only the exact file returned by the native picker may reach this cleanup guard.
export function avatarProbeCacheUri(uri: string, cacheUri: string): string {
  if (/\\|%(?:2e|2f|5c)/i.test(uri) || /\/\.{1,2}(?:\/|$)/.test(uri)) throw new Error('Unexpected picker cache path.');
  const file = new URL(uri), cache = new URL(cacheUri);
  if ([file, cache].some(url => url.protocol !== 'file:' || url.hostname || url.username || url.password || url.search || url.hash)) throw new Error('Only a local picker cache file is eligible.');
  const prefix = cache.pathname.replace(/\/$/, '') + '/';
  const relative = file.pathname.startsWith(prefix) ? file.pathname.slice(prefix.length) : '';
  if (!/^(?:ImagePicker\/)?[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.(?:jpe?g|png|webp)$/i.test(relative)) throw new Error('Only the captured native picker cache copy may be removed.');
  return file.href;
}
