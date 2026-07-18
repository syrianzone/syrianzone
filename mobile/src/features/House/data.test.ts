import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import { fetchHouseData, houseResponseSchema } from './data';

const payload = {
  data: {
    headers: ['Name', 'Place', 'Age'],
    rows: [
      {
        Age: '42',
        Name: 'أحمد',
        Place: 'دمشق',
        __ageGroup: '40s',
        __appealStatus: '',
        __nameNorm: 'احمد',
        __placeNorm: 'دمشق',
        __sexNorm: 'ذكر',
      },
    ],
  },
};

describe('House mobile API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('requests the public server proxy with mode and province', async () => {
    const request = jest
      .spyOn(apiClient, 'request')
      .mockImplementation(
        async <T>(
          _path: string,
          options: ApiRequestOptions<T>,
        ): Promise<T> => options.schema.parse(payload),
      );

    await expect(
      fetchHouseData({ mode: 'winners', province: 'damascus' }),
    ).resolves.toEqual(payload.data);
    expect(request).toHaveBeenCalledWith('/api/mobile/house', {
      auth: false,
      query: { mode: 'winners', province: 'damascus' },
      schema: houseResponseSchema,
      signal: undefined,
    });
  });

  test('rejects malformed normalized fields and arbitrary non-string cells', () => {
    expect(
      houseResponseSchema.safeParse({
        data: {
          headers: ['Name'],
          rows: [{ Name: 'أحمد', __nameNorm: 'احمد' }],
        },
      }).success,
    ).toBe(false);
    expect(
      houseResponseSchema.safeParse({
        data: {
          headers: ['Name'],
          rows: [{ ...payload.data.rows[0], votes: 12 }],
        },
      }).success,
    ).toBe(false);
    expect(
      houseResponseSchema.safeParse({
        ...payload,
        trace: 'internal-server-detail',
      }).success,
    ).toBe(false);
    expect(
      houseResponseSchema.safeParse({
        data: {
          ...payload.data,
          rows: [{ ...payload.data.rows[0], __sexNorm: 'unknown' }],
        },
      }).success,
    ).toBe(false);
  });
});
