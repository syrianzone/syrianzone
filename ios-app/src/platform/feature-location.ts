export function featureParameters(value: unknown): Record<string, string> {
  const invalid = () => new Error('الرابط غير صالح. افتح القسم من الرئيسية.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const route = value as Record<string, unknown>;
  let nested: unknown = route.params ?? {};
  if (typeof nested === 'string') {
    if (nested.length > 8192) throw invalid();
    try { nested = JSON.parse(nested); } catch { throw invalid(); }
  }
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) throw invalid();
  const entries = Object.entries({ ...route, ...nested }).filter(([key]) => key !== 'section' && key !== 'params'
    && key !== '__proto__' && key !== 'constructor' && key !== 'prototype');
  if (entries.length > 32 || entries.some(([key, item]) => !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key)
    || typeof item !== 'string' || item.length > 4096)) throw invalid();
  return Object.fromEntries(entries) as Record<string, string>;
}
