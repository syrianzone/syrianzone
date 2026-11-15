export interface CredentialPort {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

// Readers share the write queue, so bootstrap cannot see a tentative credential.
// Previous credentials exist only in memory while their transaction settles.
export function createCredentialTransactions(port: CredentialPort) {
  const tails = new Map<string, Promise<void>>(), generations = new Map<string, number>();
  const repairs = new Map<string, string | null>();
  const store = (key: string, value: string | null): Promise<void> => value === null ? port.remove(key) : port.write(key, value);
  async function repair(key: string): Promise<void> {
    if (!repairs.has(key)) return;
    try { await store(key, repairs.get(key) ?? null); repairs.delete(key); }
    catch (cause) { throw new Error('تعذر استعادة تسجيل الدخول السابق. افتح الجهاز ثم أعد المحاولة.', { cause }); }
  }
  function enqueue<T>(key: string, work: () => Promise<T>): Promise<T> {
    const result = (tails.get(key) ?? Promise.resolve()).then(work);
    const tail = result.then(() => undefined, () => undefined);
    tails.set(key, tail);
    void tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
    return result;
  }
  return {
    read: (key: string): Promise<string | null> => enqueue(key, async () => { await repair(key); return port.read(key); }),
    replace(key: string, next: string | null, isCurrent: () => boolean, onCommit: () => void): Promise<boolean> {
      if (!isCurrent()) return Promise.resolve(false);
      const generation = (generations.get(key) ?? 0) + 1;
      generations.set(key, generation);
      const current = () => generations.get(key) === generation && isCurrent();
      return enqueue(key, async () => {
        await repair(key);
        if (!current()) return false;
        const previous = await port.read(key);
        if (!current()) return false;
        async function rollback(): Promise<void> { repairs.set(key, previous); await repair(key); }
        try { await store(key, next); }
        catch (cause) { await rollback(); throw cause; }
        if (!current()) { await rollback(); return false; }
        // This synchronous commit is the linearization point. In particular,
        // its own API/session-generation update must not invalidate itself.
        try { onCommit(); }
        catch (cause) { await rollback(); throw cause; }
        return true;
      });
    },
  };
}
