import { z } from 'zod';

import { apiClient } from '@/lib/api/client';

import type {
  AdminPlace,
  MyPlace,
  NearbyPlace,
  Paginated,
  PlaceCategory,
  PlaceComment,
  PlaceDetail,
  PlaceFeatureCollection,
  PlaceListItem,
  PlaceReport,
} from './types';
import type { PlacePhotoUpload } from './submission';

const basePath = '/api/v1';

export const placeCategorySchema = z.enum([
  'historical',
  'natural',
  'cultural',
  'religious',
  'abandoned',
  'viewpoint',
  'market',
  'other',
]);

const placeStatusSchema = z.enum(['pending', 'approved', 'rejected']);
const nullableUrlSchema = z.string().nullable();
const placeUserSchema = z.object({
  avatar_url: nullableUrlSchema,
  id: z.number().int().positive(),
  name: z.string().min(1),
});
const placePhotoSchema = z.object({
  display_url: z.string().min(1),
  id: z.number().int().positive(),
  sort: z.number().int().nonnegative(),
  thumb_url: z.string().min(1),
});
export const placeListItemSchema = z.object({
  category: placeCategorySchema,
  comments_count: z.number().int().nonnegative(),
  description: z.string(),
  id: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  likes_count: z.number().int().nonnegative(),
  lng: z.number().min(-180).max(180),
  name: z.string().min(1),
  saves_count: z.number().int().nonnegative(),
  thumb_url: nullableUrlSchema,
});
const nearbyPlaceSchema = placeListItemSchema.extend({
  distance_m: z.number().int().nonnegative(),
});
const placeDetailSchema = placeListItemSchema.extend({
  created_at: z.string().min(1),
  liked_by_me: z.boolean(),
  photos: z.array(placePhotoSchema).max(5),
  saved_by_me: z.boolean(),
  status: placeStatusSchema,
  user: placeUserSchema,
});
const myPlaceSchema = placeListItemSchema.extend({
  created_at: z.string().min(1),
  rejection_reason: z.string().nullable(),
  status: placeStatusSchema,
});
const adminPlaceSchema = placeDetailSchema.extend({
  rejection_reason: z.string().nullable(),
  reports_count: z.number().int().nonnegative(),
});
const placeCommentSchema = z.object({
  body: z.string(),
  created_at: z.string().min(1),
  id: z.number().int().positive(),
  user: placeUserSchema,
});
const placeReportSchema = z.object({
  created_at: z.string().min(1),
  details: z.string().nullable(),
  id: z.number().int().positive(),
  place: z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    status: placeStatusSchema,
  }),
  reason: z.string().min(1),
  status: z.enum(['open', 'resolved', 'dismissed']),
  user: z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
  }),
});
const placeFeatureCollectionSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({
        coordinates: z.tuple([z.number(), z.number()]),
        type: z.literal('Point'),
      }),
      properties: z.object({
        category: placeCategorySchema,
        id: z.number().int().positive(),
        name: z.string().min(1),
        thumb_url: nullableUrlSchema,
      }),
      type: z.literal('Feature'),
    }),
  ),
  type: z.literal('FeatureCollection'),
});

function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    current_page: z.number().int().positive(),
    data: z.array(item),
    last_page: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  });
}

const placeListSchema = paginatedSchema(placeListItemSchema);
const myPlacesSchema = paginatedSchema(myPlaceSchema);
const adminPlacesSchema = paginatedSchema(adminPlaceSchema);
const commentsSchema = paginatedSchema(placeCommentSchema);
const reportsSchema = paginatedSchema(placeReportSchema);
const nearbySchema = z.object({ places: z.array(nearbyPlaceSchema).max(20) });
const submissionSchema = z.object({
  id: z.number().int().positive(),
  status: z.literal('pending'),
});
const engagementSchema = z.object({
  liked: z.boolean(),
  likes_count: z.number().int().nonnegative(),
});
const saveSchema = z.object({
  saved: z.boolean(),
  saves_count: z.number().int().nonnegative(),
});
const messageSchema = z.object({ message: z.string().min(1) });
const moderationSchema = z.object({
  id: z.number().int().positive(),
  status: z.string().min(1),
});
const emptySchema = z.undefined();

export const placesApi = {
  mapData: (): Promise<PlaceFeatureCollection> =>
    apiClient.request(`${basePath}/places/map`, {
      auth: false,
      schema: placeFeatureCollectionSchema,
    }),

  listPlaces: (query: {
    category?: PlaceCategory;
    page?: number;
    q?: string;
    sort?: 'newest' | 'popular';
  }): Promise<Paginated<PlaceListItem>> =>
    apiClient.request(`${basePath}/places`, {
      auth: false,
      query,
      schema: placeListSchema,
    }),

  nearby: (query: {
    include_pending?: boolean;
    lat: number;
    lng: number;
    radius_km?: number;
  }): Promise<{ places: NearbyPlace[] }> =>
    apiClient.request(`${basePath}/places/nearby`, {
      query,
      schema: nearbySchema,
    }),

  getPlace: (id: number): Promise<PlaceDetail> =>
    apiClient.request(`${basePath}/places/${id}`, {
      schema: placeDetailSchema,
    }),

  submitPlace: (data: {
    category: PlaceCategory;
    description: string;
    lat: number;
    lng: number;
    name: string;
    photos: readonly PlacePhotoUpload[];
  }) => {
    const form = new FormData();
    form.append('name', data.name);
    form.append('category', data.category);
    form.append('description', data.description);
    form.append('lat', String(data.lat));
    form.append('lng', String(data.lng));
    data.photos.forEach((photo) =>
      form.append('photos[]', {
        name: photo.fileName,
        type: photo.mimeType,
        uri: photo.uri,
      } as unknown as Blob),
    );
    return apiClient.request(`${basePath}/places`, {
      body: form,
      method: 'POST',
      schema: submissionSchema,
    });
  },

  myPlaces: (page = 1): Promise<Paginated<MyPlace>> =>
    apiClient.request(`${basePath}/my/places`, {
      query: { page },
      schema: myPlacesSchema,
    }),

  mySaves: (page = 1): Promise<Paginated<PlaceListItem>> =>
    apiClient.request(`${basePath}/my/saves`, {
      query: { page },
      schema: placeListSchema,
    }),

  like: (id: number) =>
    apiClient.request(`${basePath}/places/${id}/like`, {
      method: 'POST',
      schema: engagementSchema,
    }),
  unlike: (id: number) =>
    apiClient.request(`${basePath}/places/${id}/like`, {
      method: 'DELETE',
      schema: engagementSchema,
    }),
  save: (id: number) =>
    apiClient.request(`${basePath}/places/${id}/save`, {
      method: 'POST',
      schema: saveSchema,
    }),
  unsave: (id: number) =>
    apiClient.request(`${basePath}/places/${id}/save`, {
      method: 'DELETE',
      schema: saveSchema,
    }),

  listComments: (
    placeId: number,
    page = 1,
  ): Promise<Paginated<PlaceComment>> =>
    apiClient.request(`${basePath}/places/${placeId}/comments`, {
      auth: false,
      query: { page },
      schema: commentsSchema,
    }),
  addComment: (placeId: number, body: string): Promise<PlaceComment> =>
    apiClient.request(`${basePath}/places/${placeId}/comments`, {
      body: { body },
      method: 'POST',
      schema: placeCommentSchema,
    }),
  deleteComment: (id: number): Promise<void> =>
    apiClient.request(`${basePath}/place-comments/${id}`, {
      method: 'DELETE',
      schema: emptySchema,
    }),
  report: (id: number, reason: string, details?: string) =>
    apiClient.request(`${basePath}/places/${id}/report`, {
      body: { details, reason },
      method: 'POST',
      schema: messageSchema,
    }),

  adminListPlaces: (
    status: 'pending' | 'approved' | 'rejected' | 'all',
    page = 1,
  ): Promise<Paginated<AdminPlace>> =>
    apiClient.request(`${basePath}/admin/places`, {
      query: { page, status },
      schema: adminPlacesSchema,
    }),
  adminApprove: (id: number) =>
    apiClient.request(`${basePath}/admin/places/${id}/approve`, {
      method: 'POST',
      schema: moderationSchema,
    }),
  adminReject: (id: number, reason: string | null) =>
    apiClient.request(`${basePath}/admin/places/${id}/reject`, {
      body: { reason },
      method: 'POST',
      schema: moderationSchema,
    }),
  adminDeletePlace: (id: number): Promise<void> =>
    apiClient.request(`${basePath}/admin/places/${id}`, {
      method: 'DELETE',
      schema: emptySchema,
    }),
  adminListReports: (
    status: 'open' | 'resolved' | 'dismissed' | 'all',
    page = 1,
  ): Promise<Paginated<PlaceReport>> =>
    apiClient.request(`${basePath}/admin/place-reports`, {
      query: { page, status },
      schema: reportsSchema,
    }),
  adminResolveReport: (id: number, action: 'resolve' | 'dismiss') =>
    apiClient.request(`${basePath}/admin/place-reports/${id}/resolve`, {
      body: { action },
      method: 'POST',
      schema: moderationSchema,
    }),
};

/*
PORT STATUS
  source:     resources/js/Pages/Places/_lib/api.ts (132 lines)
  confidence: high
  todos:      0
  notes:      All public, personal, engagement, comment, report, and moderation routes use validated native contracts.
*/
