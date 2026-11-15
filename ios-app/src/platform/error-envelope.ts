export function decodeErrorEnvelope(value: unknown, retryHeader: string | null): { message: string | null; fields: Readonly<Record<string, readonly string[]>>; retryAfter: number | null } {
  const body = value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const arabic = (candidate: unknown): candidate is string => typeof candidate === 'string' && candidate.length <= 1000 && /[\u0600-\u06ff]/.test(candidate);
  const entries: [string, readonly string[]][] = [];
  if (body.errors && typeof body.errors === 'object' && !Array.isArray(body.errors)) for (const [key, raw] of Object.entries(body.errors).slice(0, 100)) {
    if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(key)) continue;
    const messages = (Array.isArray(raw) ? raw : [raw]).filter(arabic).slice(0, 5);
    if (messages.length) entries.push([key.replace(/\.\d+$/, ''), Object.freeze(messages)]);
  }
  const fields = Object.freeze(Object.fromEntries(entries));
  const message = entries[0]?.[1][0] ?? (arabic(body.message) ? body.message : arabic(body.error) ? body.error : null);
  const seconds = Number(retryHeader ?? body.retry_after);
  return { message, fields, retryAfter: Number.isFinite(seconds) && seconds > 0 && seconds <= 86400 ? Math.ceil(seconds) : null };
}
