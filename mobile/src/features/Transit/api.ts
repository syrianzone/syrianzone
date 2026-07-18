import { z } from 'zod';

import { apiClient } from '@/lib/api/client';

import type {
  City,
  MapDataResponse,
  NearbyStop,
  RouteProperties,
  TransitSearchResult,
} from './_types';
import { buildTransitDraftGeoJson, type TransitDraftStop } from './studio/model';

const coordinateSchema = z.tuple([z.number(), z.number()]);
const citySchema = z.object({
  bounds: z.tuple([coordinateSchema, coordinateSchema]).nullable(),
  center: coordinateSchema,
  id: z.string(),
  nameAr: z.string(),
  nameEn: z.string(),
  routeCount: z.number(),
  status: z.enum(['active', 'coming_soon']),
  zoom: z.number(),
});
const routeSchema = z.object({
  colorIndex: z.number(),
  id: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  priceNew: z.number().nullable().optional(),
  priceOld: z.number().nullable().optional(),
});
const mapDataSchema = z.object({
  routes: z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.object({
      type: z.literal('Feature'),
      geometry: z.object({
        type: z.literal('LineString'),
        coordinates: z.array(coordinateSchema),
      }),
      properties: routeSchema,
    })),
  }),
  stops: z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.object({
      type: z.literal('Feature'),
      geometry: z.object({
        type: z.literal('Point'),
        coordinates: coordinateSchema,
      }),
      properties: z.object({
        id: z.string(),
        nameAr: z.string(),
        nameEn: z.string().nullable().optional(),
        routeIds: z.array(z.string()),
      }),
    })),
  }),
});
const nearbySchema = z.array(z.object({
  cityId: z.string(),
  coordinates: coordinateSchema,
  id: z.string(),
  nameAr: z.string(),
  routes: z.array(z.object({ id: z.string(), name_ar: z.string() })),
}));
const searchItemSchema = z.object({
  cityId: z.string(),
  coordinates: coordinateSchema.nullable().optional(),
  id: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable().optional(),
  type: z.enum(['route', 'stop']),
});

const transitDraftSchema = z.object({
  city: z.object({ name_ar: z.string(), name_en: z.string() }).nullable(),
  city_id: z.string(),
  created_at: z.string(),
  geojson: z.unknown(),
  id: z.number().int().positive(),
  name_ar: z.string(),
  name_en: z.string().nullable(),
  notes: z.string().nullable(),
  price: z.number().nullable(),
  rejection_reason: z.string().nullable(),
  status: z.enum(['pending', 'approved', 'rejected']),
  user: z.object({
    id: z.number().int().positive(),
    is_banned: z.boolean(),
    name: z.string(),
  }).nullable(),
  user_id: z.number().int().positive().nullable(),
});

const transitSubmitterSchema = z.object({
  id: z.number().int().positive(),
  is_banned: z.boolean(),
  name: z.string().min(1),
});
const transitSubmitterResponseSchema = z.object({
  data: z.object({ user: transitSubmitterSchema }),
});

export type TransitDraft = z.infer<typeof transitDraftSchema>;
export type TransitSubmitter = z.infer<typeof transitSubmitterSchema>;

export async function getCities(): Promise<City[]> {
  return apiClient.request('/api/v1/cities', {
    auth: false,
    schema: z.array(citySchema),
  });
}

export async function getCityRoutes(cityId: string): Promise<RouteProperties[]> {
  return apiClient.request(`/api/v1/cities/${encodeURIComponent(cityId)}/routes`, {
    auth: false,
    schema: z.array(routeSchema),
  });
}

export async function getMapData(cityId: string): Promise<MapDataResponse> {
  return apiClient.request(`/api/v1/cities/${encodeURIComponent(cityId)}/map-data`, {
    auth: false,
    schema: mapDataSchema,
  }) as Promise<MapDataResponse>;
}

export async function getNearbyStops(
  latitude: number,
  longitude: number,
  radius = 750,
): Promise<NearbyStop[]> {
  return apiClient.request('/api/v1/stops/nearby', {
    auth: false,
    query: { lat: latitude, lng: longitude, radius },
    schema: nearbySchema,
  });
}

export async function searchTransit(
  query: string,
  cityId?: string,
): Promise<TransitSearchResult[]> {
  const payload = await apiClient.request('/api/v1/search', {
    auth: false,
    query: { q: query, city_id: cityId },
    schema: z.object({
      routes: z.array(searchItemSchema),
      stops: z.array(searchItemSchema),
    }),
  });
  return [...payload.routes, ...payload.stops];
}

const routeDetailSchema = z.object({
  data: z.object({
    city: citySchema,
    id: z.string(),
    route: routeSchema,
    stops: z.array(z.object({
      coordinates: coordinateSchema,
      properties: z.object({ id: z.string(), nameAr: z.string() }),
    })),
  }),
});

export type RouteDetail = z.infer<typeof routeDetailSchema>['data'];

export async function getRouteDetail(
  cityId: string,
  routeId: string,
): Promise<RouteDetail> {
  const response = await apiClient.request(
    `/api/mobile/transit/cities/${encodeURIComponent(cityId)}/routes/${encodeURIComponent(routeId)}`,
    { auth: false, schema: routeDetailSchema },
  );
  return response.data;
}

export async function submitRouteDraft(input: {
  cityId: string;
  coordinates: readonly [number, number][];
  nameAr: string;
  nameEn?: string;
  notes?: string;
  price?: number;
  stops: readonly TransitDraftStop[];
}): Promise<{ id: number }> {
  return apiClient.request('/api/v1/studio/routes', {
    body: {
      city_id: input.cityId,
      geojson: buildTransitDraftGeoJson(input.coordinates, input.stops),
      name_ar: input.nameAr,
      name_en: input.nameEn,
      notes: input.notes,
      price: input.price,
    },
    method: 'POST',
    schema: z.object({ id: z.number().int().positive() }).passthrough(),
  });
}

const actionResponseSchema = z.object({ message: z.string() }).passthrough();

export async function getTransitDrafts(): Promise<TransitDraft[]> {
  return apiClient.request('/api/mobile/admin/transit-drafts', {
    schema: z.array(transitDraftSchema),
  });
}

export async function approveTransitDraft(id: number): Promise<void> {
  await apiClient.request(`/api/mobile/admin/transit-drafts/${id}/approve`, {
    method: 'POST',
    schema: actionResponseSchema,
  });
}

export async function rejectTransitDraft(
  id: number,
  reason: string,
): Promise<void> {
  await apiClient.request(`/api/mobile/admin/transit-drafts/${id}/reject`, {
    body: { reason: reason.trim() || null },
    method: 'POST',
    schema: actionResponseSchema,
  });
}

export async function toggleTransitSubmitterBan(
  id: number,
  isBanned: boolean,
): Promise<TransitSubmitter> {
  const response = await apiClient.request(
    `/api/mobile/admin/users/${id}/toggle-ban`,
    {
      auth: true,
      body: { is_banned: isBanned },
      method: 'POST',
      schema: transitSubmitterResponseSchema,
    },
  );
  return response.data.user;
}
