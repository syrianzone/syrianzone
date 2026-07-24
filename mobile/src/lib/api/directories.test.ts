import {
  directoryQueryKeys,
  fetchGovernmentApps,
  fetchGovernmentStoreIcon,
  fetchOfficialAccounts,
  fetchOrganizations,
  fetchPhonebook,
  fetchWebsites,
  governmentAppSchema,
  officialCategorySchema,
  officialEntitySchema,
  organizationSchema,
  phonebookEntrySchema,
  resolveDirectoryImageUrl,
  websiteSchema,
} from './directories';
import { apiClient, type ApiRequestOptions } from './client';

import {
  governmentAppsFixture,
  officialAccountsResponseFixture,
  officialDirectoryFixture,
  organizationFixture,
  phonebookFixture,
  websiteFixture,
} from '../../test/fixtures/directories';

describe('directory API schemas', () => {
  it('accepts source-derived fixtures for all five endpoints', () => {
    expect(officialEntitySchema.parse(officialDirectoryFixture[0])).toBeDefined();
    expect(phonebookEntrySchema.parse(phonebookFixture[0])).toBeDefined();
    expect(websiteSchema.parse(websiteFixture[0])).toBeDefined();
    expect(organizationSchema.parse(organizationFixture[0])).toBeDefined();
    expect(governmentAppSchema.parse(governmentAppsFixture[0])).toBeDefined();
    expect(
      officialCategorySchema.parse({
        icon: null,
        id: 'ministries',
        is_active: true,
        label_ar: 'الوزارات',
        label_en: 'Ministries',
        order_column: 1,
      }),
    ).toBeDefined();
  });

  it('rejects malformed public data at the boundary', () => {
    expect(
      phonebookEntrySchema.safeParse({
        ...phonebookFixture[0],
        is_whatsapp: 'yes',
      }).success,
    ).toBe(false);
    expect(
      websiteSchema.safeParse({ ...websiteFixture[0], url: null }).success,
    ).toBe(false);
    expect(
      governmentAppSchema.safeParse({
        ...governmentAppsFixture[0],
        images: 'not-an-array',
      }).success,
    ).toBe(false);
  });
});

describe('directory API requests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the five unauthenticated mobile endpoints', async () => {
    const calls: { auth: boolean | undefined; path: string }[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({ auth: options.auth, path });
        return options.schema.parse({ data: [] });
      },
    );

    await Promise.all([
      fetchOfficialAccounts(),
      fetchPhonebook(),
      fetchWebsites(),
      fetchOrganizations(),
      fetchGovernmentApps(),
    ]);

    expect(calls).toEqual([
      { auth: false, path: '/api/mobile/official-accounts' },
      { auth: false, path: '/api/mobile/phonebook' },
      { auth: false, path: '/api/mobile/sites' },
      { auth: false, path: '/api/mobile/parties' },
      { auth: false, path: '/api/mobile/government-apps' },
    ]);
    expect(directoryQueryKeys.all).toEqual(['directories']);
  });

  it('sends the correct identifier to the store icon proxy', async () => {
    const request = jest
      .spyOn(apiClient, 'request')
      .mockImplementation(
        async <T>(
          _path: string,
          options: ApiRequestOptions<T>,
        ): Promise<T> => options.schema.parse({ icon: null }),
      );

    await fetchGovernmentStoreIcon('play', 'sy.gov.services');
    await fetchGovernmentStoreIcon('apple', '123456789');

    expect(request.mock.calls[0]?.[1].query).toEqual({
      package: 'sy.gov.services',
      store: 'play',
    });
    expect(request.mock.calls[1]?.[1].query).toEqual({
      id: '123456789',
      store: 'apple',
    });
  });

  it('matches the backend official accounts response contract', async () => {
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(
        _path: string,
        options: ApiRequestOptions<T>,
      ): Promise<T> => options.schema.parse(officialAccountsResponseFixture),
    );

    await expect(fetchOfficialAccounts()).resolves.toEqual(
      officialAccountsResponseFixture.data,
    );
  });

  it('normalizes the legacy entity array during backend rollout', async () => {
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(
        _path: string,
        options: ApiRequestOptions<T>,
      ): Promise<T> =>
        options.schema.parse({ data: [officialDirectoryFixture[0]] }),
    );

    await expect(fetchOfficialAccounts()).resolves.toEqual({
      categories: [],
      entities: [officialDirectoryFixture[0]],
    });
  });
});

describe('directory media URL handling', () => {
  it('resolves first-party paths and safe remote images', () => {
    expect(resolveDirectoryImageUrl('/assets/apps/test/icon.png')).toBe(
      'https://syrian.zone/assets/apps/test/icon.png',
    );
    expect(resolveDirectoryImageUrl('https://cdn.example.com/icon.png')).toBe(
      'https://cdn.example.com/icon.png',
    );
  });

  it('rejects empty, protocol-relative, and executable values', () => {
    expect(resolveDirectoryImageUrl('')).toBeNull();
    expect(resolveDirectoryImageUrl('//evil.example/icon.png')).toBeNull();
    expect(resolveDirectoryImageUrl('javascript:alert(1)')).toBeNull();
  });
});
