import { validTimeZone } from './prayer-zone';
type Point = { lat: number; lon: number };
export function createZoneResolver(port: { read(key: string): Promise<unknown>; write(key: string, value: { zone: string; at: number }): Promise<void>; reverse(point: Point): Promise<unknown> }, { now = Date.now, timeoutMs = 8000 }: { now?: () => number; timeoutMs?: number } = {}) {
  const memory = new Map<string, string>(), pending = new Map<string, Promise<string>>();
  function key(point: Point): string { if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) throw new Error('الموقع غير صالح.'); return `prayer-zone.v1.${point.lat.toFixed(2)}.${point.lon.toFixed(2)}`; }
  function remember(point: Point, zone: string): void { if (!validTimeZone(zone)) return; const id = key(point); memory.set(id, zone); if (memory.size > 128) { const first = memory.keys().next().value; if (first !== undefined) memory.delete(first); } void port.write(id, { zone, at: now() }).catch(() => undefined); }
  return { peek: (point: Point): string | null => memory.get(key(point)) ?? null, remember,
    resolve(point: Point): Promise<string> {
      const id = key(point), cached = memory.get(id); if (cached) return Promise.resolve(cached);
      const existing = pending.get(id); if (existing) return existing;
      const operation = (async () => {
        try { const saved = await port.read(id); if (saved && typeof saved === 'object' && 'zone' in saved && 'at' in saved && validTimeZone(saved.zone) && typeof saved.at === 'number' && now() - saved.at < 30 * 86400000) { memory.set(id, saved.zone); return saved.zone; } } catch { /* Public geocoder cache is optional. */ }
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const result = await Promise.race([port.reverse(point), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('تعذر تحديد المنطقة الزمنية للموقع.')), timeoutMs); })]);
          if (!validTimeZone(result)) throw new Error('تعذر تحديد المنطقة الزمنية للموقع.');
          remember(point, result); return result;
        } finally { if (timer) clearTimeout(timer); }
      })().finally(() => pending.delete(id));
      pending.set(id, operation); return operation;
    }
  };
}
