import { z } from 'zod';

export const authUserSchema = z.object({
  avatar_url: z.string().url().nullable(),
  email: z.string().email(),
  id: z.number().int().positive(),
  is_banned: z.boolean(),
  name: z.string().min(1),
  role: z.string().min(1),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export type BrowserLoginResult =
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'cancelled' };
