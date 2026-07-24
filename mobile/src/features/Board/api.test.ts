import { apiClient } from '@/lib/api/client';

import { getBoard, putBoard } from './api';
import { createDefaultDocument } from './model';

jest.mock('@/lib/api/client', () => ({
  apiClient: { request: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('loads the authenticated board document with response validation', async () => {
  const controller = new AbortController();
  const payload = {
    document: createDefaultDocument(),
    updated_at: '2026-07-24T10:00:00.000Z',
  };
  jest.mocked(apiClient.request).mockResolvedValue(payload);

  await expect(getBoard(controller.signal)).resolves.toEqual(payload);
  expect(apiClient.request).toHaveBeenCalledWith('/api/v1/board', {
    auth: true,
    schema: expect.anything(),
    signal: controller.signal,
  });
});

test('writes the exact document envelope with bearer authentication', async () => {
  const document = createDefaultDocument();
  const controller = new AbortController();
  jest.mocked(apiClient.request).mockResolvedValue({
    updated_at: '2026-07-24T10:00:01.000Z',
  });

  await putBoard(document, controller.signal);

  expect(apiClient.request).toHaveBeenCalledWith('/api/v1/board', {
    auth: true,
    body: { document },
    method: 'PUT',
    schema: expect.anything(),
    signal: controller.signal,
  });
});
