import { z } from 'zod';

import { apiOrigin } from '@/lib/env';

import { apiClient } from './client';
import { envelopeSchema } from './schemas';

const requiredText = z.string();
const optionalText = z.string().optional().default('');

export const officialCategorySchema = z.object({
  icon: z.string().nullable().optional().default(null),
  id: requiredText.min(1),
  is_active: z.boolean().optional().default(true),
  label_ar: requiredText.min(1),
  label_en: requiredText.min(1),
  order_column: z.number().int().nonnegative().optional().default(0),
});

export const officialEntitySchema = z.object({
  category: requiredText,
  description: requiredText,
  description_ar: requiredText,
  id: requiredText.min(1),
  image: requiredText,
  name: requiredText,
  name_ar: requiredText,
  socials: z.record(z.string(), z.string()),
});

export const phonebookEntrySchema = z.object({
  category_ar: requiredText,
  category_en: requiredText,
  category_id: z.string().optional(),
  id: requiredText.min(1),
  is_whatsapp: z.boolean(),
  name_ar: requiredText,
  name_en: requiredText,
  number: requiredText.min(1),
  source_url: requiredText,
});

export const websiteSchema = z.object({
  description: requiredText,
  id: requiredText.min(1),
  name: requiredText.min(1),
  type: requiredText,
  url: requiredText.min(1),
});

export const organizationSchema = z.object({
  city: optionalText,
  country: optionalText,
  description: optionalText,
  email: optionalText,
  formattedLocation: optionalText,
  id: requiredText.min(1),
  lang: optionalText,
  manifesto: optionalText,
  mvpMembers: optionalText,
  name: requiredText.min(1),
  phone: optionalText,
  politicalLeanings: z.array(z.string()).optional().default([]),
  socialFb: optionalText,
  socialInsta: optionalText,
  socialX: optionalText,
  telegram: optionalText,
  type: optionalText,
  website: optionalText,
  youtube: optionalText,
});

export const governmentAppSchema = z.object({
  description: z.string().nullable().transform((value) => value ?? ''),
  icon: z.string().nullable().transform((value) => value ?? ''),
  id: requiredText.min(1),
  images: z.array(z.string()),
  links: z.object({
    android: z.string().nullable().optional(),
    apple: z.string().nullable().optional(),
    official: z.string().nullable().optional(),
  }),
  name: requiredText.min(1),
});

const officialEntityListSchema = z.array(officialEntitySchema);
const officialCatalogSchema = z.object({
  categories: z.array(officialCategorySchema),
  entities: officialEntityListSchema,
});
// Accept the previous array contract while installed clients and servers roll forward.
const officialCatalogDataSchema = z.union([
  officialCatalogSchema,
  officialEntityListSchema.transform((entities) => ({
    categories: [],
    entities,
  })),
]);
const officialEntitiesResponseSchema = envelopeSchema(officialCatalogDataSchema);
const phonebookResponseSchema = envelopeSchema(z.array(phonebookEntrySchema));
const websitesResponseSchema = envelopeSchema(z.array(websiteSchema));
const organizationsResponseSchema = envelopeSchema(
  z.array(organizationSchema),
);
const governmentAppsResponseSchema = envelopeSchema(
  z.array(governmentAppSchema),
);
const storeIconResponseSchema = z.object({
  icon: z.string().url().nullable(),
});

export type DirectoryOfficialEntity = z.infer<typeof officialEntitySchema>;
export type DirectoryOfficialCategory = z.infer<typeof officialCategorySchema>;
export type DirectoryOfficialCatalog = z.infer<typeof officialCatalogSchema>;
export type DirectoryPhonebookEntry = z.infer<typeof phonebookEntrySchema>;
export type DirectoryWebsite = z.infer<typeof websiteSchema>;
export type DirectoryOrganization = z.infer<typeof organizationSchema>;
export type DirectoryGovernmentApp = z.infer<typeof governmentAppSchema>;

interface RequestOptions {
  signal?: AbortSignal;
}

export const directoryQueryKeys = {
  all: ['directories'] as const,
  governmentApps: ['directories', 'government-apps'] as const,
  officialAccounts: ['directories', 'official-accounts'] as const,
  parties: ['directories', 'parties'] as const,
  phonebook: ['directories', 'phonebook'] as const,
  sites: ['directories', 'sites'] as const,
};

export async function fetchOfficialAccounts({
  signal,
}: RequestOptions = {}): Promise<DirectoryOfficialCatalog> {
  const response = await apiClient.request('/api/mobile/official-accounts', {
    auth: false,
    schema: officialEntitiesResponseSchema,
    signal,
  });
  return response.data;
}

export async function fetchPhonebook({
  signal,
}: RequestOptions = {}): Promise<DirectoryPhonebookEntry[]> {
  const response = await apiClient.request('/api/mobile/phonebook', {
    auth: false,
    schema: phonebookResponseSchema,
    signal,
  });
  return response.data;
}

export async function fetchWebsites({
  signal,
}: RequestOptions = {}): Promise<DirectoryWebsite[]> {
  const response = await apiClient.request('/api/mobile/sites', {
    auth: false,
    schema: websitesResponseSchema,
    signal,
  });
  return response.data;
}

export async function fetchOrganizations({
  signal,
}: RequestOptions = {}): Promise<DirectoryOrganization[]> {
  const response = await apiClient.request('/api/mobile/parties', {
    auth: false,
    schema: organizationsResponseSchema,
    signal,
  });
  return response.data;
}

export async function fetchGovernmentApps({
  signal,
}: RequestOptions = {}): Promise<DirectoryGovernmentApp[]> {
  const response = await apiClient.request('/api/mobile/government-apps', {
    auth: false,
    schema: governmentAppsResponseSchema,
    signal,
  });
  return response.data;
}

export async function fetchGovernmentStoreIcon(
  store: 'apple' | 'play',
  identifier: string,
  { signal }: RequestOptions = {},
): Promise<string | null> {
  const query =
    store === 'apple'
      ? { id: identifier, store }
      : { package: identifier, store };
  const response = await apiClient.request('/api/app-icon', {
    auth: false,
    query,
    schema: storeIconResponseSchema,
    signal,
  });
  return response.icon;
}

export function resolveDirectoryImageUrl(
  value: null | string | undefined,
): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.startsWith('//')) {
    return null;
  }

  try {
    const url = new URL(candidate, `${apiOrigin}/`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
