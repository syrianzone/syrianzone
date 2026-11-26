/**
 * The `?state=` share link for the priorities simulator.
 *
 * The payload is `id:points,…|subId,…` encoded as base64 of its UTF-8 bytes.
 * Base64 can contain `+`, which a query string reads as a space, so the URL is
 * built with URLSearchParams (which percent-encodes it) and the decoder also
 * accepts older links that put the raw base64 in the query.
 */
export interface SharedPriorities {
  points: Record<string, number>;
  subFiles: string[];
}

export interface KnownPriorities {
  topics: readonly string[];
  subFiles: readonly string[];
  budget: number;
  maxSubFiles: number;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function encodeShareState(points: Record<string, number>, subFiles: readonly string[]): string {
  const text = `${Object.entries(points).map(([id, v]) => `${id}:${v}`).join(',')}|${subFiles.join(',')}`;
  return bytesToBase64(new TextEncoder().encode(text));
}

/**
 * Decodes a share payload, keeping only known topic and sub-file ids. Points
 * are clamped so their running total never exceeds the budget, and sub-files
 * are de-duplicated and capped. Returns null for anything that is not valid
 * base64 of UTF-8 text.
 */
export function decodeShareState(raw: string, known: KnownPriorities): SharedPriorities | null {
  let text: string;
  try {
    // Legacy links put raw base64 in the query, so a '+' arrives as a space.
    const bytes = base64ToBytes(raw.trim().replace(/ /g, '+'));
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }

  const [pointsStr = '', subsStr = ''] = text.split('|');
  const points: Record<string, number> = {};
  let total = 0;
  for (const item of pointsStr.split(',')) {
    const [id, val] = item.split(':');
    const value = Number.parseInt(val ?? '', 10);
    if (!id || !known.topics.includes(id) || !Number.isFinite(value) || id in points) continue;
    const clamped = Math.min(Math.max(value, 0), known.budget - total);
    points[id] = clamped;
    total += clamped;
  }

  const subFiles = [...new Set(subsStr.split(',').filter((id) => known.subFiles.includes(id)))]
    .slice(0, known.maxSubFiles);

  return { points, subFiles };
}

export function shareStateUrl(location: Pick<Location, 'origin' | 'pathname'>, state: string): string {
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('state', state);
  return url.toString();
}
