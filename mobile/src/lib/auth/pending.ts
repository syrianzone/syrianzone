import { z } from 'zod';

import { pendingAuthStorage } from '@/lib/storage/secure';

const pendingAuthSchema = z.object({
  createdAt: z.number().int().nonnegative(),
  deviceName: z.string().min(1).max(80),
  redirectUri: z.string().min(1),
  state: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
});

export type PendingAuthTransaction = z.infer<typeof pendingAuthSchema>;

export interface PendingAuthStringStorage {
  clear: () => Promise<void>;
  get: () => Promise<string | null>;
  set: (value: string) => Promise<void>;
}

export interface PendingAuthStore {
  clear: () => Promise<void>;
  load: (now?: number) => Promise<PendingAuthTransaction | null>;
  save: (transaction: PendingAuthTransaction) => Promise<void>;
}

const pendingLifetimeMs = 15 * 60 * 1_000;

export function createPendingAuthStore(
  storage: PendingAuthStringStorage,
): PendingAuthStore {
  return {
    clear: storage.clear,
    async load(now = Date.now()) {
      const raw = await storage.get();
      if (!raw) {
        return null;
      }
      try {
        const parsed = pendingAuthSchema.safeParse(JSON.parse(raw));
        if (
          !parsed.success ||
          parsed.data.createdAt > now + 60_000 ||
          parsed.data.createdAt < now - pendingLifetimeMs
        ) {
          await storage.clear();
          return null;
        }
        return parsed.data;
      } catch {
        await storage.clear();
        return null;
      }
    },
    save(transaction) {
      return storage.set(JSON.stringify(pendingAuthSchema.parse(transaction)));
    },
  };
}

export const nativePendingAuthStore = createPendingAuthStore(
  pendingAuthStorage,
);
