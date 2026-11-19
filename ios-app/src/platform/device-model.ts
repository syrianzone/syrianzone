export function createInstallationId({ read, write, random }: { read(): Promise<string | null>; write(value: string): Promise<void>; random(): string }): () => Promise<string> {
  let pending: Promise<string> | null = null;
  let current: string | null = null;
  const valid = (value: string): boolean => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
  return async () => {
    if (current) return current;
    pending ??= (async () => {
      const saved = await read();
      if (saved !== null) {
        if (!valid(saved)) throw new Error('تعذر قراءة المعرّف المحفوظ.');
        current = saved; return saved;
      }
      const value = random();
      if (!valid(value)) throw new Error('تعذر إنشاء المعرّف.');
      await write(value); current = value; return value;
    })().finally(() => { pending = null; });
    return pending;
  };
}
