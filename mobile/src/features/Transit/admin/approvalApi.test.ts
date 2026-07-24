import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import { approveTransitDraft } from '../api';

describe('transit draft approval API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('posts the selected bounded route color with the approval', async () => {
    const request = jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        expect(path).toBe('/api/mobile/admin/transit-drafts/42/approve');
        expect(options).toMatchObject({
          auth: true,
          body: { color_index: 6 },
          method: 'POST',
        });
        return options.schema.parse({ message: 'ok' });
      },
    );

    await approveTransitDraft(42, 6);

    expect(request).toHaveBeenCalledTimes(1);
  });

  test('keeps color optional for callers that rely on the server default', async () => {
    const request = jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(_path: string, options: ApiRequestOptions<T>): Promise<T> =>
        options.schema.parse({ message: 'ok' }),
    );

    await approveTransitDraft(43);

    expect(request.mock.calls[0]?.[1].body).toBeUndefined();
  });
});
