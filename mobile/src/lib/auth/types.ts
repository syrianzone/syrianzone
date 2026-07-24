import { z } from 'zod';

export const authUserSchema = z.object({
  avatar_url: z.string().url().nullable(),
  email: z.string().email(),
  id: z.number().int().positive(),
  is_banned: z.boolean(),
  name: z.string().min(1),
  permissions: z.array(z.string()).optional(),
  role: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export type BrowserLoginResult =
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'cancelled' };
