import { z } from 'zod';

import { apiClient } from '@/lib/api/client';

import type { BoardDocument } from './types';

const boardResponseSchema = z.object({
  document: z.unknown().nullable(),
  updated_at: z.string().nullable(),
});

const putBoardResponseSchema = z.object({
  updated_at: z.string(),
});

export function getBoard(
  signal?: AbortSignal,
): Promise<z.infer<typeof boardResponseSchema>> {
  return apiClient.request('/api/v1/board', {
    auth: true,
    schema: boardResponseSchema,
    signal,
  });
}

export function putBoard(
  document: BoardDocument,
  signal?: AbortSignal,
): Promise<z.infer<typeof putBoardResponseSchema>> {
  return apiClient.request('/api/v1/board', {
    auth: true,
    body: { document },
    method: 'PUT',
    schema: putBoardResponseSchema,
    signal,
  });
}

/*
PORT STATUS
  source:     resources/js/Pages/Board/_lib/api.ts (32 lines)
  confidence: high
  todos:      0
  notes:      Typed native requests preserve authenticated Board reads, writes, validation, and revision responses.
*/
