import type { AuthUser } from '@/lib/auth/types';

import type { MapDataResponse, RouteFeature, StopFeature } from '../_types';
import type {
  PublishedRoute,
  PublishedRouteGeoJson,
  TransitDraft,
} from '../api';

export type DraftStatusFilter = 'all' | TransitDraft['status'];

export const TRANSIT_ADMIN_PERMISSIONS = {
  approve: 'transit.approve',
  combineRoutes: 'transit.combine_routes',
  editRoutes: 'transit.edit_routes',
  moveRoutes: 'transit.move_routes',
  reject: 'transit.reject',
  reviewDrafts: 'transit.review_drafts',
  splitRoutes: 'transit.split_routes',
  viewLogs: 'transit.view_logs',
} as const;

export type TransitAdminCapability = keyof typeof TRANSIT_ADMIN_PERMISSIONS;

export type TransitAdminAccess = Readonly<
  Record<TransitAdminCapability, boolean> & {
    canAccess: boolean;
    canManageDrafts: boolean;
    canManagePublishedRoutes: boolean;
  }
>;

type TransitAdminIdentity = Pick<AuthUser, 'role'> &
  Partial<Pick<AuthUser, 'is_banned' | 'permissions'>>;

export function transitAdminDraftsQueryKey(userId: number) {
  return ['transit-admin-drafts', userId] as const;
}

export function transitAdminAccess(
  user: TransitAdminIdentity | null | undefined,
): TransitAdminAccess {
  const permissions = user?.permissions ?? [];
  const hasFullAccess =
    user !== null &&
    user !== undefined &&
    user.is_banned !== true &&
    (user.role === 'admin' ||
      user.role === 'superadmin' ||
      user.role === 'transit_admin' ||
      permissions.includes('*'));
  const hasPermission = (permission: string) =>
    user?.is_banned !== true &&
    (hasFullAccess || permissions.includes(permission));
  const capabilities: Record<TransitAdminCapability, boolean> = {
    approve: hasPermission(TRANSIT_ADMIN_PERMISSIONS.approve),
    combineRoutes: hasPermission(TRANSIT_ADMIN_PERMISSIONS.combineRoutes),
    editRoutes: hasPermission(TRANSIT_ADMIN_PERMISSIONS.editRoutes),
    moveRoutes: hasPermission(TRANSIT_ADMIN_PERMISSIONS.moveRoutes),
    reject: hasPermission(TRANSIT_ADMIN_PERMISSIONS.reject),
    reviewDrafts: hasPermission(TRANSIT_ADMIN_PERMISSIONS.reviewDrafts),
    splitRoutes: hasPermission(TRANSIT_ADMIN_PERMISSIONS.splitRoutes),
    viewLogs: hasPermission(TRANSIT_ADMIN_PERMISSIONS.viewLogs),
  };
  const canManageDrafts =
    capabilities.reviewDrafts || capabilities.approve || capabilities.reject;
  const canManagePublishedRoutes =
    capabilities.editRoutes ||
    capabilities.moveRoutes ||
    capabilities.combineRoutes ||
    capabilities.splitRoutes ||
    capabilities.viewLogs;

  return {
    ...capabilities,
    canAccess: canManageDrafts || canManagePublishedRoutes,
    canManageDrafts,
    canManagePublishedRoutes,
  };
}

function readObject(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function readGeoJson(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'string') {
    return readObject(value);
  }
  try {
    return readObject(JSON.parse(value));
  } catch {
    return null;
  }
}

function readCoordinate(value: unknown): [number, number] | null {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    typeof value[0] !== 'number' ||
    typeof value[1] !== 'number' ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1]) ||
    Math.abs(value[0]) > 180 ||
    Math.abs(value[1]) > 90
  ) {
    return null;
  }
  return [value[0], value[1]];
}

function readLine(value: unknown): [number, number][] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const coordinates = value.map(readCoordinate);
  if (coordinates.length < 2 || coordinates.some((item) => item === null)) {
    return null;
  }
  return coordinates as [number, number][];
}

function geoJsonFeatures(
  value: unknown,
): readonly Readonly<Record<string, unknown>>[] {
  const geojson = readGeoJson(value);
  const features = geojson?.features;
  return Array.isArray(features)
    ? features.map(readObject).filter((item) => item !== null)
    : [];
}

function draftFeatures(draft: TransitDraft) {
  return geoJsonFeatures(draft.geojson);
}

export function transitDraftStats(drafts: readonly TransitDraft[]) {
  return {
    approved: drafts.filter((draft) => draft.status === 'approved').length,
    pending: drafts.filter((draft) => draft.status === 'pending').length,
    rejected: drafts.filter((draft) => draft.status === 'rejected').length,
  };
}

export function filterTransitDrafts(
  drafts: readonly TransitDraft[],
  status: DraftStatusFilter,
  cityId: string,
): TransitDraft[] {
  return drafts
    .filter((draft) => status === 'all' || draft.status === status)
    .filter((draft) => cityId === 'all' || draft.city_id === cityId)
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );
}

export function transitDraftStopCount(draft: TransitDraft): number {
  return draftFeatures(draft).filter((feature) => {
    const geometry = readObject(feature.geometry);
    return geometry?.type === 'Point' && readCoordinate(geometry.coordinates) !== null;
  }).length;
}

export function buildDraftMapData(
  draft: TransitDraft,
  reference?: MapDataResponse | null,
  colorIndex = 2,
): MapDataResponse {
  const routes: RouteFeature[] = [...(reference?.routes.features ?? [])];
  const stops: StopFeature[] = [...(reference?.stops.features ?? [])];
  let routeIndex = 0;
  let stopIndex = 0;

  for (const feature of draftFeatures(draft)) {
    const geometry = readObject(feature.geometry);
    const properties = readObject(feature.properties);
    if (geometry?.type === 'LineString') {
      const coordinates = readLine(geometry.coordinates);
      if (coordinates) {
        routes.push({
          geometry: { coordinates, type: 'LineString' },
          properties: {
            colorIndex,
            id: `draft-route-${draft.id}-${routeIndex}`,
            nameAr: draft.name_ar,
            nameEn: draft.name_en,
            priceNew: draft.price,
          },
          type: 'Feature',
        });
        routeIndex += 1;
      }
    } else if (geometry?.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
      for (const rawLine of geometry.coordinates) {
        const coordinates = readLine(rawLine);
        if (coordinates) {
          routes.push({
            geometry: { coordinates, type: 'LineString' },
            properties: {
              colorIndex,
              id: `draft-route-${draft.id}-${routeIndex}`,
              nameAr: draft.name_ar,
              nameEn: draft.name_en,
              priceNew: draft.price,
            },
            type: 'Feature',
          });
          routeIndex += 1;
        }
      }
    } else if (geometry?.type === 'Point') {
      const coordinates = readCoordinate(geometry.coordinates);
      if (coordinates) {
        stops.push({
          geometry: { coordinates, type: 'Point' },
          properties: {
            id: `draft-stop-${draft.id}-${stopIndex}`,
            nameAr:
              typeof properties?.nameAr === 'string' && properties.nameAr.trim()
                ? properties.nameAr
                : `محطة ${stopIndex + 1}`,
            routeIds: [`draft-route-${draft.id}-0`],
          },
          type: 'Feature',
        });
        stopIndex += 1;
      }
    }
  }

  return {
    routes: { features: routes, type: 'FeatureCollection' },
    stops: { features: stops, type: 'FeatureCollection' },
  };
}

export function buildPublishedRouteMapData(
  route: PublishedRoute,
  geoJson: PublishedRouteGeoJson,
  reference?: MapDataResponse | null,
): MapDataResponse {
  const routes: RouteFeature[] = [...(reference?.routes.features ?? [])];
  const stops: StopFeature[] = [...(reference?.stops.features ?? [])];
  let routeIndex = 0;
  let stopIndex = 0;

  for (const feature of geoJsonFeatures(geoJson)) {
    const geometry = readObject(feature.geometry);
    const properties = readObject(feature.properties);
    const addRoute = (coordinates: [number, number][]) => {
      routes.push({
        geometry: { coordinates, type: 'LineString' },
        properties: {
          colorIndex: route.color_index,
          id: routeIndex === 0 ? route.id : `${route.id}-${routeIndex}`,
          nameAr: route.name_ar,
          nameEn: route.name_en,
          priceNew: route.price_new,
          priceOld: route.price_old,
        },
        type: 'Feature',
      });
      routeIndex += 1;
    };

    if (geometry?.type === 'LineString') {
      const coordinates = readLine(geometry.coordinates);
      if (coordinates) {
        addRoute(coordinates);
      }
    } else if (
      geometry?.type === 'MultiLineString' &&
      Array.isArray(geometry.coordinates)
    ) {
      for (const rawLine of geometry.coordinates) {
        const coordinates = readLine(rawLine);
        if (coordinates) {
          addRoute(coordinates);
        }
      }
    } else if (geometry?.type === 'Point') {
      const coordinates = readCoordinate(geometry.coordinates);
      if (coordinates) {
        stops.push({
          geometry: { coordinates, type: 'Point' },
          properties: {
            id:
              typeof properties?.id === 'string'
                ? properties.id
                : `${route.id}-stop-${stopIndex}`,
            nameAr:
              typeof properties?.nameAr === 'string'
                ? properties.nameAr
                : `محطة ${stopIndex + 1}`,
            nameEn:
              typeof properties?.nameEn === 'string'
                ? properties.nameEn
                : null,
            routeIds: [route.id],
          },
          type: 'Feature',
        });
        stopIndex += 1;
      }
    }
  }

  return {
    routes: { features: routes, type: 'FeatureCollection' },
    stops: { features: stops, type: 'FeatureCollection' },
  };
}
