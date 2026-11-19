import type { KeyValueStore } from '../storage';

export function createDocumentStore(storage: KeyValueStore): {
  read<T>(key: string, decode: (value: unknown) => T, fallback: T): Promise<T>;
  write<T>(key: string, value: T): Promise<void>;
} {
  const name = (key: string): string => {
    if (!/^[a-zA-Z0-9._-]{1,128}$/.test(key)) throw new Error('اسم الحفظ غير صالح.');
    return `syrian-zone.document.${key}`;
  };
  return {
    async read<T>(key: string, decode: (value: unknown) => T, fallback: T): Promise<T> {
      let raw: string | null;
      try { raw = await storage.getItemAsync(name(key)); }
      catch { throw new Error('تعذر قراءة البيانات من الجهاز. حاول مجدداً.'); }
      if (raw === null) return fallback;
      try { return decode(JSON.parse(raw) as unknown); }
      catch { throw new Error('تعذر قراءة البيانات المحفوظة. لم يتم تغييرها.'); }
    },
    async write<T>(key: string, value: T): Promise<void> {
      const json = JSON.stringify(value);
      if (json === undefined) throw new Error('لا يمكن حفظ هذه البيانات.');
      try { await storage.setItemAsync(name(key), json); }
      catch { throw new Error('تعذر حفظ البيانات على الجهاز. حاول مجدداً.'); }
    }
  };
}
