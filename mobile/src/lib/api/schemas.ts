import { z } from 'zod';

export function envelopeSchema<T extends z.ZodType>(
  data: T,
): z.ZodObject<{ data: T }> {
  return z.object({ data });
}

export const identifierSchema = z.union([z.number().int(), z.string().min(1)]);

export const paginationMetaSchema = z.object({
  current_page: z.number().int().positive(),
  last_page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export function paginatedEnvelopeSchema<T extends z.ZodType>(
  item: T,
): z.ZodObject<{
  data: z.ZodArray<T>;
  meta: typeof paginationMetaSchema;
}> {
  return z.object({
    data: z.array(item),
    meta: paginationMetaSchema,
  });
}
