import { z } from 'zod';

import { apiClient, type ApiClient } from '@/lib/api/client';

import { authUserSchema, type AuthUser } from './types';

const exchangeResponseSchema = z.object({
  expires_at: z.string().min(1),
  token: z.string().min(1),
  token_type: z.literal('Bearer'),
  user: authUserSchema,
});

const userResponseSchema = z.object({ user: authUserSchema });
const logoutResponseSchema = z.object({ message: z.string() });

export interface ExchangeInput {
  code: string;
  codeVerifier: string;
  deviceName: string;
}

export type ExchangeResponse = z.infer<typeof exchangeResponseSchema>;

export interface AuthApi {
  exchange: (input: ExchangeInput) => Promise<ExchangeResponse>;
  getUser: () => Promise<AuthUser>;
  logout: () => Promise<void>;
}

export function createAuthApi(client: ApiClient = apiClient): AuthApi {
  return {
    async exchange(input) {
      return client.request('/api/mobile/auth/exchange', {
        auth: false,
        body: {
          code: input.code,
          code_verifier: input.codeVerifier,
          device_name: input.deviceName,
        },
        method: 'POST',
        schema: exchangeResponseSchema,
      });
    },
    async getUser() {
      const response = await client.request('/api/mobile/user', {
        schema: userResponseSchema,
      });
      return response.user;
    },
    async logout() {
      await client.request('/api/mobile/logout', {
        method: 'POST',
        schema: logoutResponseSchema,
      });
    },
  };
}

export const authApi = createAuthApi();
