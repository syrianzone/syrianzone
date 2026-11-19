export type QueryParameters = Readonly<Record<string, string | number | boolean | null | undefined>>;
export interface PageBootstrap { component: string; version: string; props: Record<string, unknown> }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('أعاد الخادم بيانات غير صالحة.');
  return value as Record<string, unknown>;
}

function entities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|quot|apos|amp|lt|gt);/gi, (whole, entity: string) => {
    const named: Record<string, string> = { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' };
    if (!entity.startsWith('#')) return named[entity.toLowerCase()] ?? whole;
    const code = Number.parseInt(entity.slice(entity[1]?.toLowerCase() === 'x' ? 2 : 1), entity[1]?.toLowerCase() === 'x' ? 16 : 10);
    return Number.isSafeInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

// Both Inertia bootstrap formats contain data only. Never execute page scripts.
export function parsePageBootstrap(html: string): PageBootstrap {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(match =>
    /(?:^|\s)data-page\s*=\s*(["'])app\1/i.test(match[1] ?? '') && /(?:^|\s)type\s*=\s*(["'])application\/json\1/i.test(match[1] ?? ''));
  if (scripts.length > 1) throw new Error('تعذر قراءة بيانات المنصة.');
  const appTag = [...html.matchAll(/<div\b[^>]*>/gi)].find(match => /\sid\s*=\s*(["'])app\1/i.test(match[0]))?.[0];
  const encoded = appTag?.match(/\sdata-page\s*=\s*(["'])([\s\S]*?)\1/i)?.[2];
  const json = scripts[0]?.[2] ?? (encoded ? entities(encoded) : null);
  if (!json) throw new Error('تعذر قراءة بيانات المنصة.');
  const page = object(JSON.parse(json));
  if (typeof page.component !== 'string' || (page.version !== null && typeof page.version !== 'string')) throw new Error('بيانات المنصة غير صالحة.');
  return { component: page.component, version: page.version ?? '', props: object(page.props) };
}

export function parsePageResponse(value: unknown, expectedComponent: string): Record<string, unknown> {
  const page = object(value);
  if (page.component !== expectedComponent) throw new Error('تعذر فتح هذا القسم.');
  return object(page.props);
}

export function resolveSitePath(origin: URL, path: string, params?: QueryParameters): URL {
  const rawPath = path.split('?')[0] ?? '';
  let decoded: string;
  try { decoded = decodeURIComponent(rawPath); } catch { throw new Error('الطلب غير صالح.'); }
  if (!path || path.startsWith('//') || path.includes('\\') || /^[a-z][a-z\d+.-]*:/i.test(path) || decoded.split('/').some(part => part === '..' || part === '.')) {
    throw new Error('الطلب غير صالح.');
  }
  const url = new URL(path.startsWith('/') ? path : `/api/v1/${path}`, origin);
  if (url.origin !== origin.origin || url.hash) throw new Error('الطلب غير صالح.');
  for (const [key, value] of Object.entries(params ?? {})) if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  return url;
}

export async function waitForSignal<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending;
  if (signal.aborted) throw new Error('تم إلغاء الطلب.');
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([pending, new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(new Error('تم إلغاء الطلب.'));
      signal.addEventListener('abort', onAbort, { once: true });
    })]);
  } finally { if (onAbort) signal.removeEventListener('abort', onAbort); }
}
