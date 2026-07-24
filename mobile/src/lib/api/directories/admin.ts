import { z } from 'zod';

import { apiClient } from '../client';
import { envelopeSchema } from '../schemas';

const nullableText = z.string().nullable().optional().default(null);
const requiredText = z.string().min(1);

export const adminOfficialCategorySchema = z.object({
  icon: nullableText,
  id: requiredText,
  is_active: z.boolean(),
  label_ar: requiredText,
  label_en: requiredText,
  order_column: z.number().int().nonnegative(),
});

export const adminOfficialEntitySchema = z.object({
  category_id: requiredText,
  description: nullableText,
  description_ar: nullableText,
  id: requiredText,
  image: nullableText,
  is_active: z.boolean(),
  name: requiredText,
  name_ar: requiredText,
  order_column: z.number().int().nonnegative(),
  socials: z.record(z.string(), z.string()).default({}),
});

export const adminGovernmentAppSchema = z.object({
  description: nullableText,
  description_ar: nullableText,
  icon: nullableText,
  id: requiredText,
  images: z.array(z.string()).optional().default([]),
  is_active: z.boolean(),
  links: z.record(z.string(), z.string().nullable()).default({}),
  name: requiredText,
  name_ar: requiredText,
  order_column: z.number().int().nonnegative(),
});

export const adminPhonebookCategorySchema = z.object({
  icon: nullableText,
  id: requiredText,
  is_active: z.boolean(),
  label_ar: requiredText,
  label_en: requiredText,
  order_column: z.number().int().nonnegative(),
});

export const adminPhonebookEntrySchema = z.object({
  category_id: requiredText,
  id: requiredText,
  is_active: z.boolean(),
  is_whatsapp: z.boolean(),
  name_ar: requiredText,
  name_en: nullableText,
  number: requiredText,
  order_column: z.number().int().nonnegative(),
  source_url: nullableText,
});

const officialAdminResponseSchema = envelopeSchema(
  z.object({
    categories: z.array(adminOfficialCategorySchema),
    entities: z.array(adminOfficialEntitySchema),
  }),
);
const governmentAppsAdminResponseSchema = envelopeSchema(
  z.array(adminGovernmentAppSchema),
);
const phonebookAdminResponseSchema = envelopeSchema(
  z.object({
    categories: z.array(adminPhonebookCategorySchema),
    entries: z.array(adminPhonebookEntrySchema),
  }),
);
const officialCategoryResponseSchema = envelopeSchema(
  adminOfficialCategorySchema,
);
const officialEntityResponseSchema = envelopeSchema(adminOfficialEntitySchema);
const governmentAppResponseSchema = envelopeSchema(adminGovernmentAppSchema);
const phonebookCategoryResponseSchema = envelopeSchema(
  adminPhonebookCategorySchema,
);
const phonebookEntryResponseSchema = envelopeSchema(adminPhonebookEntrySchema);
const operationResponseSchema = envelopeSchema(
  z.union([
    z.object({ deleted: z.literal(true) }),
    z.object({ success: z.literal(true) }),
  ]),
);

export type AdminOfficialCategory = z.infer<
  typeof adminOfficialCategorySchema
>;
export type AdminOfficialEntity = z.infer<typeof adminOfficialEntitySchema>;
export type AdminGovernmentApp = z.infer<typeof adminGovernmentAppSchema>;
export type AdminPhonebookCategory = z.infer<
  typeof adminPhonebookCategorySchema
>;
export type AdminPhonebookEntry = z.infer<typeof adminPhonebookEntrySchema>;

export interface PickedDirectoryImage {
  filename: string;
  uri: string;
}

export interface OfficialCategoryInput {
  icon: null | string;
  id?: string;
  isActive: boolean;
  labelAr: string;
  labelEn: string;
}

export interface OfficialEntityInput {
  categoryId: string;
  description: null | string;
  descriptionAr: null | string;
  image?: PickedDirectoryImage | null;
  isActive: boolean;
  name: string;
  nameAr: string;
  socials: Readonly<Record<string, string>>;
}

export interface GovernmentAppInput {
  description: null | string;
  descriptionAr: null | string;
  icon?: PickedDirectoryImage | null;
  id?: string;
  isActive: boolean;
  links: Readonly<Record<string, string>>;
  name: string;
  nameAr: string;
}

export interface PhonebookCategoryInput {
  icon: null | string;
  id?: string;
  isActive: boolean;
  labelAr: string;
  labelEn: string;
}

export interface PhonebookEntryInput {
  categoryId: string;
  id?: string;
  isActive: boolean;
  isWhatsapp: boolean;
  nameAr: string;
  nameEn: null | string;
  number: string;
  sourceUrl: null | string;
}

function identifier(value: string): string {
  return encodeURIComponent(value);
}

function imageType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'png') {
    return 'image/png';
  }
  if (extension === 'webp') {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function appendImage(
  form: FormData,
  field: 'icon_file' | 'image_file',
  image: PickedDirectoryImage | null | undefined,
): void {
  if (!image) {
    return;
  }
  form.append(
    field,
    {
      name: image.filename,
      type: imageType(image.filename),
      uri: image.uri,
    } as unknown as Blob,
  );
}

function appendRecord(
  form: FormData,
  field: 'links' | 'socials',
  values: Readonly<Record<string, string>>,
): void {
  for (const [key, value] of Object.entries(values)) {
    if (value) {
      form.append(`${field}[${key}]`, value);
    }
  }
}

function officialEntityForm(
  id: string | undefined,
  input: OfficialEntityInput,
): FormData {
  const form = new FormData();
  if (id) {
    form.append('id', id);
  }
  form.append('category_id', input.categoryId);
  form.append('name', input.name);
  form.append('name_ar', input.nameAr);
  form.append('description', input.description ?? '');
  form.append('description_ar', input.descriptionAr ?? '');
  form.append('is_active', input.isActive ? '1' : '0');
  appendRecord(form, 'socials', input.socials);
  appendImage(form, 'image_file', input.image);
  return form;
}

function governmentAppForm(
  id: string | undefined,
  input: GovernmentAppInput,
): FormData {
  const form = new FormData();
  if (id) {
    form.append('id', id);
  }
  form.append('name', input.name);
  form.append('name_ar', input.nameAr);
  form.append('description', input.description ?? '');
  form.append('description_ar', input.descriptionAr ?? '');
  form.append('is_active', input.isActive ? '1' : '0');
  appendRecord(form, 'links', input.links);
  appendImage(form, 'icon_file', input.icon);
  return form;
}

export async function fetchOfficialAdmin(signal?: AbortSignal) {
  const response = await apiClient.request('/api/mobile/admin/syofficial', {
    auth: true,
    schema: officialAdminResponseSchema,
    signal,
  });
  return response.data;
}

export async function createOfficialCategory(input: OfficialCategoryInput) {
  const response = await apiClient.request(
    '/api/mobile/admin/syofficial/categories',
    {
      auth: true,
      body: {
        icon: input.icon,
        id: input.id,
        is_active: input.isActive,
        label_ar: input.labelAr,
        label_en: input.labelEn,
      },
      method: 'POST',
      schema: officialCategoryResponseSchema,
    },
  );
  return response.data;
}

export async function updateOfficialCategory(
  id: string,
  input: OfficialCategoryInput,
) {
  const response = await apiClient.request(
    `/api/mobile/admin/syofficial/categories/${identifier(id)}`,
    {
      auth: true,
      body: {
        icon: input.icon,
        is_active: input.isActive,
        label_ar: input.labelAr,
        label_en: input.labelEn,
      },
      method: 'PUT',
      schema: officialCategoryResponseSchema,
    },
  );
  return response.data;
}

export async function deleteOfficialCategory(id: string): Promise<void> {
  await apiClient.request(
    `/api/mobile/admin/syofficial/categories/${identifier(id)}`,
    {
      auth: true,
      method: 'DELETE',
      schema: operationResponseSchema,
    },
  );
}

export async function createOfficialEntity(
  id: string,
  input: OfficialEntityInput,
) {
  const response = await apiClient.request(
    '/api/mobile/admin/syofficial/entities',
    {
      auth: true,
      body: officialEntityForm(id, input),
      method: 'POST',
      schema: officialEntityResponseSchema,
    },
  );
  return response.data;
}

export async function updateOfficialEntity(
  id: string,
  input: OfficialEntityInput,
) {
  const response = await apiClient.request(
    `/api/mobile/admin/syofficial/entities/${identifier(id)}`,
    {
      auth: true,
      body: officialEntityForm(undefined, input),
      method: 'POST',
      schema: officialEntityResponseSchema,
    },
  );
  return response.data;
}

export async function setOfficialEntityVisibility(
  id: string,
  isActive: boolean,
) {
  const response = await apiClient.request(
    `/api/mobile/admin/syofficial/entities/${identifier(id)}/visibility`,
    {
      auth: true,
      body: { is_active: isActive },
      method: 'PATCH',
      schema: officialEntityResponseSchema,
    },
  );
  return response.data;
}

export async function deleteOfficialEntity(id: string): Promise<void> {
  await apiClient.request(
    `/api/mobile/admin/syofficial/entities/${identifier(id)}`,
    {
      auth: true,
      method: 'DELETE',
      schema: operationResponseSchema,
    },
  );
}

export async function reorderOfficialCategories(
  ids: readonly string[],
): Promise<void> {
  await apiClient.request(
    '/api/mobile/admin/syofficial/reorder/categories',
    {
      auth: true,
      body: {
        orders: ids.map((id, index) => ({ id, order_column: index + 1 })),
      },
      method: 'POST',
      schema: operationResponseSchema,
    },
  );
}

export async function reorderOfficialEntities(
  ids: readonly string[],
): Promise<void> {
  await apiClient.request('/api/mobile/admin/syofficial/reorder/entities', {
    auth: true,
    body: {
      orders: ids.map((id, index) => ({ id, order_column: index + 1 })),
    },
    method: 'POST',
    schema: operationResponseSchema,
  });
}

export async function fetchGovernmentAppsAdmin(signal?: AbortSignal) {
  const response = await apiClient.request('/api/mobile/admin/govapps', {
    auth: true,
    schema: governmentAppsAdminResponseSchema,
    signal,
  });
  return response.data;
}

export async function createGovernmentApp(
  id: string,
  input: GovernmentAppInput,
) {
  const response = await apiClient.request('/api/mobile/admin/govapps', {
    auth: true,
    body: governmentAppForm(id, input),
    method: 'POST',
    schema: governmentAppResponseSchema,
  });
  return response.data;
}

export async function updateGovernmentApp(
  id: string,
  input: GovernmentAppInput,
) {
  const response = await apiClient.request(
    `/api/mobile/admin/govapps/${identifier(id)}`,
    {
      auth: true,
      body: governmentAppForm(undefined, input),
      method: 'POST',
      schema: governmentAppResponseSchema,
    },
  );
  return response.data;
}

export async function setGovernmentAppVisibility(
  id: string,
  isActive: boolean,
) {
  const response = await apiClient.request(
    `/api/mobile/admin/govapps/${identifier(id)}/visibility`,
    {
      auth: true,
      body: { is_active: isActive },
      method: 'PATCH',
      schema: governmentAppResponseSchema,
    },
  );
  return response.data;
}

export async function deleteGovernmentApp(id: string): Promise<void> {
  await apiClient.request(
    `/api/mobile/admin/govapps/${identifier(id)}`,
    {
      auth: true,
      method: 'DELETE',
      schema: operationResponseSchema,
    },
  );
}

export async function reorderGovernmentApps(
  ids: readonly string[],
): Promise<void> {
  await apiClient.request('/api/mobile/admin/govapps/reorder', {
    auth: true,
    body: {
      orders: ids.map((id, index) => ({ id, order_column: index + 1 })),
    },
    method: 'POST',
    schema: operationResponseSchema,
  });
}

export async function fetchPhonebookAdmin(signal?: AbortSignal) {
  const response = await apiClient.request('/api/mobile/admin/phonebook', {
    auth: true,
    schema: phonebookAdminResponseSchema,
    signal,
  });
  return response.data;
}

export async function createPhonebookCategory(input: PhonebookCategoryInput) {
  const response = await apiClient.request(
    '/api/mobile/admin/phonebook/categories',
    {
      auth: true,
      body: {
        icon: input.icon,
        id: input.id,
        is_active: input.isActive,
        label_ar: input.labelAr,
        label_en: input.labelEn,
      },
      method: 'POST',
      schema: phonebookCategoryResponseSchema,
    },
  );
  return response.data;
}

export async function updatePhonebookCategory(
  id: string,
  input: PhonebookCategoryInput,
) {
  const response = await apiClient.request(
    `/api/mobile/admin/phonebook/categories/${identifier(id)}`,
    {
      auth: true,
      body: {
        icon: input.icon,
        is_active: input.isActive,
        label_ar: input.labelAr,
        label_en: input.labelEn,
      },
      method: 'PUT',
      schema: phonebookCategoryResponseSchema,
    },
  );
  return response.data;
}

export async function deletePhonebookCategory(id: string): Promise<void> {
  await apiClient.request(
    `/api/mobile/admin/phonebook/categories/${identifier(id)}`,
    {
      auth: true,
      method: 'DELETE',
      schema: operationResponseSchema,
    },
  );
}

export async function createPhonebookEntry(input: PhonebookEntryInput) {
  const response = await apiClient.request(
    '/api/mobile/admin/phonebook/entries',
    {
      auth: true,
      body: {
        category_id: input.categoryId,
        id: input.id,
        is_active: input.isActive,
        is_whatsapp: input.isWhatsapp,
        name_ar: input.nameAr,
        name_en: input.nameEn,
        number: input.number,
        source_url: input.sourceUrl,
      },
      method: 'POST',
      schema: phonebookEntryResponseSchema,
    },
  );
  return response.data;
}

export async function updatePhonebookEntry(
  id: string,
  input: PhonebookEntryInput,
) {
  const response = await apiClient.request(
    `/api/mobile/admin/phonebook/entries/${identifier(id)}`,
    {
      auth: true,
      body: {
        category_id: input.categoryId,
        is_active: input.isActive,
        is_whatsapp: input.isWhatsapp,
        name_ar: input.nameAr,
        name_en: input.nameEn,
        number: input.number,
        source_url: input.sourceUrl,
      },
      method: 'PUT',
      schema: phonebookEntryResponseSchema,
    },
  );
  return response.data;
}

export async function setPhonebookEntryVisibility(
  id: string,
  isActive: boolean,
) {
  const response = await apiClient.request(
    `/api/mobile/admin/phonebook/entries/${identifier(id)}/visibility`,
    {
      auth: true,
      body: { is_active: isActive },
      method: 'PATCH',
      schema: phonebookEntryResponseSchema,
    },
  );
  return response.data;
}

export async function deletePhonebookEntry(id: string): Promise<void> {
  await apiClient.request(
    `/api/mobile/admin/phonebook/entries/${identifier(id)}`,
    {
      auth: true,
      method: 'DELETE',
      schema: operationResponseSchema,
    },
  );
}

export async function reorderPhonebookCategories(
  ids: readonly string[],
): Promise<void> {
  await apiClient.request(
    '/api/mobile/admin/phonebook/reorder/categories',
    {
      auth: true,
      body: { order: ids },
      method: 'POST',
      schema: operationResponseSchema,
    },
  );
}

export async function reorderPhonebookEntries(
  ids: readonly string[],
): Promise<void> {
  await apiClient.request('/api/mobile/admin/phonebook/reorder/entries', {
    auth: true,
    body: { order: ids },
    method: 'POST',
    schema: operationResponseSchema,
  });
}
