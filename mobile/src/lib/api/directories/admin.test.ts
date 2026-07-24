import { apiClient, type ApiRequestOptions } from '../client';

import {
  createOfficialCategory,
  deleteGovernmentApp,
  fetchGovernmentAppsAdmin,
  fetchOfficialAdmin,
  fetchPhonebookAdmin,
  reorderPhonebookEntries,
  setGovernmentAppVisibility,
  updateOfficialEntity,
} from './admin';

describe('native directory admin API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses bearer list endpoints for all three admin directories', async () => {
    const calls: { auth: boolean | undefined; path: string }[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({ auth: options.auth, path });
        const data = path.endsWith('syofficial')
          ? { categories: [], entities: [] }
          : path.endsWith('govapps')
            ? []
            : { categories: [], entries: [] };
        return options.schema.parse({ data });
      },
    );

    await Promise.all([
      fetchOfficialAdmin(),
      fetchGovernmentAppsAdmin(),
      fetchPhonebookAdmin(),
    ]);

    expect(calls).toEqual([
      { auth: true, path: '/api/mobile/admin/syofficial' },
      { auth: true, path: '/api/mobile/admin/govapps' },
      { auth: true, path: '/api/mobile/admin/phonebook' },
    ]);
  });

  test('uses safe mutation paths, multipart images, visibility, and reorder', async () => {
    const calls: { body: unknown; method: string | undefined; path: string }[] =
      [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({ body: options.body, method: options.method, path });
        if (path.includes('/categories')) {
          return options.schema.parse({
            data: {
              icon: null,
              id: 'ministries',
              is_active: true,
              label_ar: 'الوزارات',
              label_en: 'Ministries',
              order_column: 1,
            },
          });
        }
        if (path.includes('/entities/')) {
          return options.schema.parse({
            data: {
              category_id: 'ministries',
              description: '',
              description_ar: '',
              id: 'health',
              image: 'https://media.example.com/health.webp',
              is_active: true,
              name: 'Health',
              name_ar: 'الصحة',
              order_column: 1,
              socials: {},
            },
          });
        }
        if (path.endsWith('/visibility')) {
          return options.schema.parse({
            data: {
              description: '',
              description_ar: '',
              icon: '',
              id: 'services',
              images: [],
              is_active: false,
              links: {},
              name: 'Services',
              name_ar: 'خدماتي',
              order_column: 1,
            },
          });
        }
        if (path.endsWith('/reorder/entries')) {
          return options.schema.parse({ data: { success: true } });
        }
        return options.schema.parse({ data: { deleted: true } });
      },
    );

    await createOfficialCategory({
      icon: null,
      id: 'ministries',
      isActive: true,
      labelAr: 'الوزارات',
      labelEn: 'Ministries',
    });
    await updateOfficialEntity('health', {
      categoryId: 'ministries',
      description: '',
      descriptionAr: '',
      image: { filename: 'health.jpg', uri: 'file:///health.jpg' },
      isActive: true,
      name: 'Health',
      nameAr: 'الصحة',
      socials: {},
    });
    await setGovernmentAppVisibility('services', false);
    await deleteGovernmentApp('services');
    await reorderPhonebookEntries(['emergency', 'health']);

    expect(calls.map(({ method, path }) => ({ method, path }))).toEqual([
      {
        method: 'POST',
        path: '/api/mobile/admin/syofficial/categories',
      },
      {
        method: 'POST',
        path: '/api/mobile/admin/syofficial/entities/health',
      },
      {
        method: 'PATCH',
        path: '/api/mobile/admin/govapps/services/visibility',
      },
      {
        method: 'DELETE',
        path: '/api/mobile/admin/govapps/services',
      },
      {
        method: 'POST',
        path: '/api/mobile/admin/phonebook/reorder/entries',
      },
    ]);
    expect(calls[1]?.body).toBeInstanceOf(FormData);
  });
});
