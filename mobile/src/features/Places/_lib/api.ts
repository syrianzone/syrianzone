import { z } from 'zod';

import { apiClient } from '@/lib/api/client';
import { apiOrigin } from '@/lib/env';

import type {
  AdminPlace,
  GeoSuggestion,
  GridPhoto,
  Guide,
  GuidesSort,
  LatLng,
  MyPlace,
  NearbyPlace,
  Paginated,
  PlaceCategory,
  PlaceDetail,
  PlaceFeatureCollection,
  PlaceListItem,
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
  'food',
  'other',
]);

const placeStatusSchema = z.enum(['pending', 'approved', 'rejected']);
const mediaUrlSchema = z
  .string()
  .min(1)
  .refine((value) => {
    if (value.startsWith('//')) {
      return false;
    }
    try {
      const url = new URL(value, `${apiOrigin}/`);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  })
  .transform((value) => new URL(value, `${apiOrigin}/`).toString());
const nullableUrlSchema = mediaUrlSchema.nullable();
const placeContributorSchema = z.object({
  avatar_url: nullableUrlSchema,
  id: z.number().int().positive(),
  name: z.string().min(1),
});
const placeUserSchema = placeContributorSchema.extend({
  level: z.number().int().min(1).max(10),
  points: z.number().int().nonnegative(),
});
const placePhotoSchema = z.object({
  display_url: mediaUrlSchema,
  id: z.number().int().positive(),
  sort: z.number().int().nonnegative(),
  thumb_url: mediaUrlSchema,
});
export const placeListItemSchema = z.object({
  category: placeCategorySchema,
  description: z.string(),
  id: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
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
  photos: z.array(placePhotoSchema).max(10),
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
  user: placeContributorSchema,
});
export const placeFeatureCollectionSchema = z.object({
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
        user_id: z.number().int().positive(),
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
const nearbySchema = z.object({ places: z.array(nearbyPlaceSchema).max(20) });
const submissionSchema = z.object({
  id: z.number().int().positive(),
  status: z.literal('pending'),
});
const saveSchema = z.object({
  saved: z.boolean(),
  saves_count: z.number().int().nonnegative(),
});
const moderationSchema = z.object({
  id: z.number().int().positive(),
  status: z.string().min(1),
});
const emptySchema = z.undefined();
const addedPhotoSchema = placePhotoSchema;
const changedPhotoSchema = placePhotoSchema.omit({ sort: true });
const geoSuggestionSchema = z.object({
  address: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  name: z.string().min(1),
});
const geocodeSchema = z.object({ suggestions: z.array(geoSuggestionSchema).max(5) });
export const guideSchema = z.object({
  approved_count: z.number().int().nonnegative(),
  avatar_url: nullableUrlSchema,
  level: z.number().int().min(1).max(10),
  name: z.string().min(1),
  points: z.number().int().nonnegative(),
  rank: z.number().int().positive().max(20),
  recent_count: z.number().int().nonnegative(),
  saves_total: z.number().int().nonnegative(),
  user_id: z.number().int().positive(),
});
const guidesSchema = z.object({
  guides: z.array(guideSchema).max(20),
  sort: z.enum(['points', 'submissions', 'saves', 'recent']),
});
const gridPhotoSchema = z.object({
  display_url: mediaUrlSchema,
  id: z.number().int().positive(),
  place: z.object({
    category: placeCategorySchema,
    id: z.number().int().positive(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    name: z.string().min(1),
  }),
  thumb_url: mediaUrlSchema,
});
const gridPhotosSchema = paginatedSchema(gridPhotoSchema);
const ownerLocationSchema = z.object({
  id: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  status: z.literal('pending'),
});
const ownerDetailsSchema = z.object({
  category: placeCategorySchema,
  description: z.string(),
  id: z.number().int().positive(),
  name: z.string().min(1),
  status: z.literal('pending'),
});
const ownerPhotoSchema = placePhotoSchema.extend({ place_status: z.literal('pending') });
const ownerDeletedPhotoSchema = z.object({
  id: z.number().int().positive(),
  place_status: z.literal('pending'),
});
const ownerResubmitSchema = z.object({
  id: z.number().int().positive(),
  status: z.literal('pending'),
});

function photoForm(photo: PlacePhotoUpload): FormData {
  const form = new FormData();
  form.append('photo', {
    name: photo.fileName,
    type: photo.mimeType,
    uri: photo.uri,
  } as unknown as Blob);
  return form;
}

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
    user_id?: number;
  }): Promise<Paginated<PlaceListItem>> =>
    apiClient.request(`${basePath}/places`, {
      auth: false,
      query,
      schema: placeListSchema,
    }),

  geocode: (q: string): Promise<{ suggestions: GeoSuggestion[] }> =>
    apiClient.request(`${basePath}/places/geocode`, {
      auth: false,
      query: { q },
      schema: geocodeSchema,
    }),

  guides: (sort: GuidesSort): Promise<{ sort: GuidesSort; guides: Guide[] }> =>
    apiClient.request(`${basePath}/guides`, {
      auth: false,
      query: { sort },
      schema: guidesSchema,
    }),

  gridPhotos: (page = 1, userId?: number): Promise<Paginated<GridPhoto>> =>
    apiClient.request(`${basePath}/places/photos`, {
      auth: false,
      query: { page, user_id: userId },
      schema: gridPhotosSchema,
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

  updateMyPlaceLocation: (id: number, point: LatLng) =>
    apiClient.request(`${basePath}/my/places/${id}/location`, {
      body: point,
      method: 'PATCH',
      schema: ownerLocationSchema,
    }),

  updateMyPlace: (
    id: number,
    data: Partial<Pick<MyPlace, 'category' | 'description' | 'name'>>,
  ) =>
    apiClient.request(`${basePath}/my/places/${id}`, {
      body: data,
      method: 'PATCH',
      schema: ownerDetailsSchema,
    }),

  addMyPhoto: (id: number, photo: PlacePhotoUpload) =>
    apiClient.request(`${basePath}/my/places/${id}/photos`, {
      body: photoForm(photo),
      method: 'POST',
      schema: ownerPhotoSchema,
    }),

  deleteMyPhoto: (id: number) =>
    apiClient.request(`${basePath}/my/place-photos/${id}`, {
      method: 'DELETE',
      schema: ownerDeletedPhotoSchema,
    }),

  rotateMyPhoto: (id: number) =>
    apiClient.request(`${basePath}/my/place-photos/${id}/rotate`, {
      method: 'POST',
      schema: changedPhotoSchema,
    }),

  resubmitMyPlace: (id: number) =>
    apiClient.request(`${basePath}/my/places/${id}/resubmit`, {
      method: 'POST',
      schema: ownerResubmitSchema,
    }),

  deleteMyPlace: (id: number): Promise<void> =>
    apiClient.request(`${basePath}/my/places/${id}`, {
      method: 'DELETE',
      schema: emptySchema,
    }),

  mySaves: (page = 1): Promise<Paginated<PlaceListItem>> =>
    apiClient.request(`${basePath}/my/saves`, {
      query: { page },
      schema: placeListSchema,
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
  adminUpdatePlace: (
    id: number,
    data: Partial<
      Pick<AdminPlace, 'category' | 'description' | 'lat' | 'lng' | 'name'>
    >,
  ): Promise<AdminPlace> =>
    apiClient.request(`${basePath}/admin/places/${id}`, {
      body: data,
      method: 'PATCH',
      schema: adminPlaceSchema,
    }),
  adminAddPhoto: (id: number, photo: PlacePhotoUpload) =>
    apiClient.request(`${basePath}/admin/places/${id}/photos`, {
      body: photoForm(photo),
      method: 'POST',
      schema: addedPhotoSchema,
    }),
  adminDeletePhoto: (id: number): Promise<void> =>
    apiClient.request(`${basePath}/admin/place-photos/${id}`, {
      method: 'DELETE',
      schema: emptySchema,
    }),
  adminRotatePhoto: (id: number) =>
    apiClient.request(`${basePath}/admin/place-photos/${id}/rotate`, {
      method: 'POST',
      schema: changedPhotoSchema,
    }),
  adminReplacePhoto: (id: number, photo: PlacePhotoUpload) =>
    apiClient.request(`${basePath}/admin/place-photos/${id}/replace`, {
      body: photoForm(photo),
      method: 'POST',
      schema: changedPhotoSchema,
    }),
};

/*
PORT STATUS
  source:     resources/js/Pages/Places/_lib/api.ts (203 lines)
  confidence: high
  todos:      0
  notes:      Public, guide-filtered discovery, level, owner, save, photo, and moderation routes use validated native contracts.
*/
