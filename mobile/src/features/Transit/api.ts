import { z } from 'zod';

import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

import cities from './_data/cities';
import type {
  City,
  MapDataResponse,
  NearbyStop,
  RouteProperties,
  TransitSearchResult,
} from './_types';
import { buildTransitDraftGeoJson, type TransitDraftStop } from './studio/model';

const coordinateSchema = z.tuple([z.number(), z.number()]);
const routeColorIndexSchema = z.number().int().min(0).max(7);
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
  stopsCount: z.number().int().nonnegative().optional(),
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

const transitStudioDraftSchema = z.object({
  city_id: z.string(),
  geojson: z.unknown(),
  id: z.union([z.number().int().positive(), z.string().min(1)]),
  is_published_route: z.boolean().optional(),
  name_ar: z.string(),
  name_en: z.string().nullable(),
  notes: z.string().nullable(),
  price: z.number().nullable(),
  route_id: z.string().nullable().optional(),
}).passthrough();

const transitSubmitterSchema = z.object({
  id: z.number().int().positive(),
  is_banned: z.boolean(),
  name: z.string().min(1),
});
const transitSubmitterResponseSchema = z.object({
  data: z.object({ user: transitSubmitterSchema }),
});

const publishedRouteSchema = z.object({
  city: z.object({ name_ar: z.string(), name_en: z.string() }).nullable(),
  city_id: z.string(),
  color_index: routeColorIndexSchema,
  created_at: z.string(),
  id: z.string(),
  name_ar: z.string(),
  name_en: z.string().nullable(),
  price_new: z.number().nullable(),
  price_old: z.number().nullable(),
  status: z.enum(['published', 'disapproved', 'hidden']),
  stops_count: z.number().int().nonnegative(),
});

const transitRouteLogSchema = z.object({
  action: z.string(),
  created_at: z.string(),
  description: z.string(),
  id: z.number().int().positive(),
  route_id: z.string().nullable(),
  user: z.object({ name: z.string() }).nullable(),
});

const publishedRouteStopSchema = z.object({
  coordinates: coordinateSchema,
  id: z.string(),
  name_ar: z.string(),
  name_en: z.string().nullable().optional(),
});

const adminGeoJsonSchema = z.object({
  features: z.array(z.unknown()),
  type: z.literal('FeatureCollection'),
});

export type TransitDraft = z.infer<typeof transitDraftSchema>;
export type TransitStudioDraft = z.infer<typeof transitStudioDraftSchema>;
export type TransitSubmitter = z.infer<typeof transitSubmitterSchema>;
export type PublishedRoute = z.infer<typeof publishedRouteSchema>;
export type PublishedRouteGeoJson = z.infer<typeof adminGeoJsonSchema>;
export type PublishedRouteStop = z.infer<typeof publishedRouteStopSchema>;
export type TransitRouteLog = z.infer<typeof transitRouteLogSchema>;

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
      properties: z.object({
        id: z.string(),
        nameAr: z.string(),
        nameEn: z.string().nullable().optional(),
      }),
    })),
  }),
});

export type RouteDetail = z.infer<typeof routeDetailSchema>['data'];

function shouldFallBack(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.code === 'network');
}

// The public map data already carries every route and its stops, so a route page
// can be assembled from it. Stops keep the map-data order, which follows the line.
export function routeDetailFromMapData(
  city: City,
  mapData: MapDataResponse,
  routeId: string,
): RouteDetail | null {
  const feature = mapData.routes.features.find((item) => item.properties.id === routeId);
  if (!feature) {
    return null;
  }
  return {
    city,
    id: routeId,
    route: feature.properties,
    stops: mapData.stops.features
      .filter((stop) => stop.properties.routeIds.includes(routeId))
      .map((stop) => ({
        coordinates: stop.geometry.coordinates as [number, number],
        properties: {
          id: stop.properties.id,
          nameAr: stop.properties.nameAr,
          nameEn: stop.properties.nameEn,
        },
      })),
  };
}

// Production does not serve /api/mobile yet, so a 404 (or no network) falls back
// to the live v1 map data plus the bundled city record.
export async function getRouteDetail(
  cityId: string,
  routeId: string,
): Promise<RouteDetail> {
  try {
    const response = await apiClient.request(
      `/api/mobile/transit/cities/${encodeURIComponent(cityId)}/routes/${encodeURIComponent(routeId)}`,
      { auth: false, schema: routeDetailSchema },
    );
    return response.data;
  } catch (error) {
    if (!shouldFallBack(error)) {
      throw error;
    }
  }
  // The bundled list is frozen tuples; City is the API shape, which reads the same.
  const city = cities.find((item) => item.id === cityId) as City | undefined;
  const detail = city
    ? routeDetailFromMapData(city, await getMapData(cityId), routeId)
    : null;
  if (!detail) {
    throw new ApiError(404, 'not_found', 'الخط غير موجود.');
  }
  return detail;
}

export interface SaveRouteDraftInput {
  cityId: string;
  coordinates: readonly [number, number][];
  draftId?: number;
  nameAr: string;
  nameEn?: string;
  notes?: string;
  price?: number;
  routeId?: string;
  stops: readonly TransitDraftStop[];
}

export async function getTransitStudioDraft(
  id: number,
): Promise<TransitStudioDraft> {
  return apiClient.request(`/api/v1/studio/routes/${id}`, {
    auth: true,
    schema: transitStudioDraftSchema,
  });
}

export async function getPublishedRouteForEdit(
  id: string,
): Promise<TransitStudioDraft> {
  return apiClient.request(
    `/api/v1/studio/routes/${encodeURIComponent(id)}/from-route`,
    { auth: true, schema: transitStudioDraftSchema },
  );
}

export async function saveRouteDraft(
  input: SaveRouteDraftInput,
): Promise<{ id: number }> {
  const body: Record<string, unknown> = {
    city_id: input.cityId,
    geojson: buildTransitDraftGeoJson(input.coordinates, input.stops),
    name_ar: input.nameAr,
    name_en: input.nameEn,
    notes: input.notes,
    price: input.price,
  };
  if (input.routeId) {
    body.route_id = input.routeId;
  }
  return apiClient.request(
    input.draftId
      ? `/api/v1/studio/routes/${input.draftId}`
      : '/api/v1/studio/routes',
    {
      auth: true,
      body,
      method: input.draftId ? 'PUT' : 'POST',
      schema: z.object({ id: z.number().int().positive() }).passthrough(),
    },
  );
}

export async function submitRouteDraft(
  input: SaveRouteDraftInput,
): Promise<{ id: number }> {
  return saveRouteDraft({
    cityId: input.cityId,
    coordinates: input.coordinates,
    nameAr: input.nameAr,
    ...(input.nameEn === undefined ? {} : { nameEn: input.nameEn }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.price === undefined ? {} : { price: input.price }),
    stops: input.stops,
  });
}

const actionResponseSchema = z.object({ message: z.string() }).passthrough();

export async function getTransitDrafts(): Promise<TransitDraft[]> {
  return apiClient.request('/api/mobile/admin/transit-drafts', {
    auth: true,
    schema: z.array(transitDraftSchema),
  });
}

export async function approveTransitDraft(
  id: number,
  colorIndex?: number,
): Promise<void> {
  const body =
    colorIndex === undefined
      ? undefined
      : { color_index: routeColorIndexSchema.parse(colorIndex) };
  await apiClient.request(`/api/mobile/admin/transit-drafts/${id}/approve`, {
    auth: true,
    body,
    method: 'POST',
    schema: actionResponseSchema,
  });
}

export async function rejectTransitDraft(
  id: number,
  reason: string,
): Promise<void> {
  await apiClient.request(`/api/mobile/admin/transit-drafts/${id}/reject`, {
    auth: true,
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

export async function getPublishedRoutes(): Promise<PublishedRoute[]> {
  return apiClient.request('/api/mobile/admin/routes', {
    auth: true,
    schema: z.array(publishedRouteSchema),
  });
}

export async function getTransitRouteLogs(): Promise<TransitRouteLog[]> {
  return apiClient.request('/api/mobile/admin/routes/logs', {
    auth: true,
    schema: z.array(transitRouteLogSchema),
  });
}

export async function getPublishedRouteGeoJson(
  id: string,
): Promise<PublishedRouteGeoJson> {
  return apiClient.request(
    `/api/mobile/admin/routes/${encodeURIComponent(id)}/geojson`,
    { auth: true, schema: adminGeoJsonSchema },
  );
}

export async function getPublishedRouteStops(
  id: string,
): Promise<PublishedRouteStop[]> {
  return apiClient.request(
    `/api/mobile/admin/routes/${encodeURIComponent(id)}/stops`,
    { auth: true, schema: z.array(publishedRouteStopSchema) },
  );
}

export type PublishedRouteStatus = PublishedRoute['status'];

export async function updatePublishedRouteStatus(
  id: string,
  status: PublishedRouteStatus,
): Promise<void> {
  await apiClient.request(
    `/api/mobile/admin/routes/${encodeURIComponent(id)}/status`,
    {
      auth: true,
      body: { status },
      method: 'POST',
      schema: actionResponseSchema,
    },
  );
}

export async function updatePublishedRoute(
  id: string,
  input: {
    colorIndex: number;
    nameAr: string;
    nameEn: string | null;
    priceNew: number | null;
    priceOld: number | null;
  },
): Promise<void> {
  await apiClient.request(
    `/api/mobile/admin/routes/${encodeURIComponent(id)}`,
    {
      auth: true,
      body: {
        color_index: routeColorIndexSchema.parse(input.colorIndex),
        name_ar: input.nameAr,
        name_en: input.nameEn,
        price_new: input.priceNew,
        price_old: input.priceOld,
      },
      method: 'PUT',
      schema: actionResponseSchema,
    },
  );
}

export async function movePublishedRoute(
  id: string,
  cityId: string,
): Promise<void> {
  await apiClient.request(
    `/api/mobile/admin/routes/${encodeURIComponent(id)}/move`,
    {
      auth: true,
      body: { city_id: cityId },
      method: 'POST',
      schema: actionResponseSchema,
    },
  );
}

export async function combinePublishedRoutes(input: {
  nameAr: string;
  nameEn: string | null;
  price: number | null;
  routeAId: string;
  routeBId: string;
}): Promise<void> {
  await apiClient.request('/api/mobile/admin/routes/combine', {
    auth: true,
    body: {
      name_ar: input.nameAr,
      name_en: input.nameEn,
      price: input.price,
      route_a_id: input.routeAId,
      route_b_id: input.routeBId,
    },
    method: 'POST',
    schema: actionResponseSchema,
  });
}

export async function splitPublishedRoute(input: {
  nameAAr: string;
  nameAEn: string | null;
  nameBAr: string;
  nameBEn: string | null;
  routeId: string;
  splitStopId: string;
}): Promise<void> {
  await apiClient.request('/api/mobile/admin/routes/split', {
    auth: true,
    body: {
      name_a_ar: input.nameAAr,
      name_a_en: input.nameAEn,
      name_b_ar: input.nameBAr,
      name_b_en: input.nameBEn,
      route_id: input.routeId,
      split_stop_id: input.splitStopId,
    },
    method: 'POST',
    schema: actionResponseSchema,
  });
}
