export interface RealtimeConfig { host: string; port: number; scheme: 'https'; key: string }

export function parseRealtimeConfig(html: string): RealtimeConfig {
  const literal = /window\.REVERB_CONFIG\s*=\s*window\.REVERB_CONFIG\s*\|\|\s*\{([^{}]*)\}\s*;/.exec(html)?.[1];
  if (!literal) throw new Error('إعداد الاتصال المباشر غير متاح.');
  const values: Record<string, unknown> = {};
  let end = 0;
  const field = /\s*(host|port|scheme|key)\s*:\s*("(?:[^"\\]|\\.)*"|\d+)\s*(,|$)/gy;
  while (end < literal.length) {
    if (!literal.slice(end).trim()) break;
    field.lastIndex = end;
    const match = field.exec(literal);
    const key = match?.[1], raw = match?.[2];
    if (!match || !key || !raw || Object.hasOwn(values, key)) throw new Error('إعداد الاتصال المباشر غير صالح.');
    values[key] = JSON.parse(raw) as unknown;
    end = field.lastIndex;
  }
  if (typeof values.host !== 'string' || !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/.test(values.host) || values.scheme !== 'https' || typeof values.port !== 'number' || !Number.isInteger(values.port) || values.port < 1 || values.port > 65535 || typeof values.key !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(values.key)) throw new Error('إعداد الاتصال المباشر غير صالح.');
  return { host: values.host, port: values.port, scheme: values.scheme, key: values.key };
}
