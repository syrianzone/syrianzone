import { z } from 'zod';

import { apiClient, type ApiClient } from '@/lib/api/client';
import { apiOrigin } from '@/lib/env';

import type {
  GuessWhoBoundSession,
  GuessWhoCategory,
  GuessWhoCategorySelection,
  GuessWhoCredential,
  GuessWhoRealtimeConfig,
  GuessWhoRoomSnapshot,
  GuessWhoSignalRequest,
  GuessWhoTurnCredentials,
} from './types';

const playerRoleSchema = z.enum(['player_1', 'player_2']);
const roomStatusSchema = z.enum(['ended', 'lobby', 'playing', 'selecting']);
const envelope = <T extends z.ZodType>(schema: T) => z.object({ data: schema });
const timestampSchema = z.string().min(1).refine(
  (value) => Number.isFinite(Date.parse(value)),
  'Expected an ISO timestamp',
);

const categorySchema = z.object({
  characters_count: z.number().int().nonnegative(),
  id: z.number().int().positive(),
  name_ar: z.string().min(1),
  name_en: z.string(),
  slug: z.string(),
});

const characterSchema = z.object({
  id: z.number().int().positive(),
  image_path: z.string().min(1),
  name_ar: z.string().min(1),
});

const credentialSchema = z.object({
  credential: z.string().min(32),
  expires_at: timestampSchema,
  session_id: z.string().min(1),
});

const roomBindingSchema = z.object({
  generation: z.number().int().nonnegative(),
  role: playerRoleSchema,
  room_code: z.string().min(4).max(64),
});

const roomSnapshotSchema = z.object({
  category: z.object({
    characters: z.array(characterSchema).min(12).max(24),
    name_ar: z.string().min(1),
  }),
  generation: z.number().int().nonnegative(),
  role: playerRoleSchema,
  room_code: z.string().min(4).max(64),
  status: roomStatusSchema,
});

const iceServerSchema = z.object({
  credential: z.string().optional(),
  urls: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  username: z.string().optional(),
});

const turnCredentialsSchema = z.object({
  expires_at: timestampSchema,
  ice_servers: z.array(iceServerSchema).min(1),
});

const realtimeConfigSchema = z.object({
  force_tls: z.boolean(),
  host: z.string().min(1),
  key: z.string().min(1),
  ws_port: z.number().int().positive().max(65_535),
  wss_port: z.number().int().positive().max(65_535),
});

const categoriesSchema = envelope(
  z.object({
    categories: z.array(categorySchema),
    total_characters: z.number().int().nonnegative(),
  }),
);
const credentialResponseSchema = envelope(credentialSchema);
const roomBindingResponseSchema = envelope(roomBindingSchema);
const roomResponseSchema = envelope(roomSnapshotSchema);
const signalResponseSchema = envelope(z.object({ status: z.literal('signal_sent') }));
const turnResponseSchema = envelope(turnCredentialsSchema);
const realtimeResponseSchema = envelope(realtimeConfigSchema);

const basePath = '/api/mobile/guess-who';

function sessionHeaders(credential: string): Readonly<Record<string, string>> {
  return { 'X-Guess-Who-Session-ID': credential };
}

export interface GuessWhoCategoriesResponse {
  categories: readonly GuessWhoCategory[];
  total_characters: number;
}

export interface GuessWhoApi {
  createRoom: (
    categoryId: GuessWhoCategorySelection,
    credential: GuessWhoCredential,
    signal?: AbortSignal,
  ) => Promise<GuessWhoBoundSession>;
  getCategories: (signal?: AbortSignal) => Promise<GuessWhoCategoriesResponse>;
  getRealtimeConfig: (signal?: AbortSignal) => Promise<GuessWhoRealtimeConfig>;
  getRoom: (
    roomCode: string,
    credential: string,
    signal?: AbortSignal,
  ) => Promise<GuessWhoRoomSnapshot>;
  getTurnCredentials: (
    roomCode: string,
    credential: string,
    signal?: AbortSignal,
  ) => Promise<GuessWhoTurnCredentials>;
  issueSession: (signal?: AbortSignal) => Promise<GuessWhoCredential>;
  joinRoom: (
    roomCode: string,
    credential: GuessWhoCredential,
    signal?: AbortSignal,
  ) => Promise<GuessWhoBoundSession>;
  sendSignal: (
    roomCode: string,
    credential: string,
    request: GuessWhoSignalRequest,
    signal?: AbortSignal,
  ) => Promise<void>;
}

export function createGuessWhoApi(client: ApiClient = apiClient): GuessWhoApi {
  return {
    async getCategories(signal) {
      const response = await client.request(`${basePath}/categories`, {
        auth: false,
        schema: categoriesSchema,
        signal,
      });
      return response.data;
    },

    async issueSession(signal) {
      const response = await client.request(`${basePath}/sessions`, {
        auth: false,
        method: 'POST',
        schema: credentialResponseSchema,
        signal,
      });
      return response.data;
    },

    async createRoom(categoryId, credential, signal) {
      const response = await client.request(`${basePath}/rooms`, {
        auth: false,
        body: { category_id: categoryId },
        headers: sessionHeaders(credential.credential),
        method: 'POST',
        schema: roomBindingResponseSchema,
        signal,
      });
      return { ...credential, ...response.data };
    },

    async joinRoom(roomCode, credential, signal) {
      const response = await client.request(
        `${basePath}/rooms/${encodeURIComponent(roomCode)}/join`,
        {
          auth: false,
          headers: sessionHeaders(credential.credential),
          method: 'POST',
          schema: roomBindingResponseSchema,
          signal,
        },
      );
      return { ...credential, ...response.data };
    },

    async getRoom(roomCode, credential, signal) {
      const response = await client.request(
        `${basePath}/rooms/${encodeURIComponent(roomCode)}`,
        {
          auth: false,
          headers: sessionHeaders(credential),
          schema: roomResponseSchema,
          signal,
        },
      );
      return response.data;
    },

    async sendSignal(roomCode, credential, request, signal) {
      await client.request(
        `${basePath}/rooms/${encodeURIComponent(roomCode)}/signal`,
        {
          auth: false,
          body: request,
          headers: sessionHeaders(credential),
          method: 'POST',
          schema: signalResponseSchema,
          signal,
        },
      );
    },

    async getTurnCredentials(roomCode, credential, signal) {
      const response = await client.request(`${basePath}/turn-credentials`, {
        auth: false,
        body: { room_code: roomCode },
        headers: sessionHeaders(credential),
        method: 'POST',
        schema: turnResponseSchema,
        signal,
      });
      return response.data;
    },

    async getRealtimeConfig(signal) {
      const response = await client.request('/api/mobile/realtime', {
        auth: false,
        schema: realtimeResponseSchema,
        signal,
      });
      return response.data;
    },
  };
}

export const guessWhoApi = createGuessWhoApi();

export function resolveGuessWhoCharacterImage(path: string): string {
  const encodedPath = path
    .trim()
    .replace(/^\/+/, '')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map(encodeURIComponent)
    .join('/');
  return new URL(`storage/${encodedPath}`, `${apiOrigin}/`).toString();
}
