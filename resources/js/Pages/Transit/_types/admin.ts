/** A route draft in the moderation queue (`GET /api/v1/admin/route-drafts`). */
import type { RouteDraftRow } from '@/Domain/transit/types'

export type RouteStatus = 'published' | 'disapproved' | 'hidden'

/**
 * The queue's row: the draft columns both listings carry (`RouteDraftRow`) plus
 * what the admin screen loads on top — the contributor, the linked published
 * route and the drawn geometry.
 */
export interface Draft extends RouteDraftRow {
  user: { name: string } | null
  linked_route: { name_ar: string; name_en: string } | null
  /** GeoJSON, usually a JSON string on the wire; normalise before drawing. */
  geojson: unknown
}

export interface PublishedRoute {
  id: string
  city_id: string
  city: { name_ar: string; name_en: string } | null
  name_ar: string
  name_en: string | null
  color_index?: number
  price_old: number | null
  price_new: number | null
  status: RouteStatus
  stops_count: number
  created_at: string
}

export interface ActivityLog {
  id: number
  route_id: string | null
  action: string
  description: string
  user: { name: string } | null
  created_at: string
}

export interface RouteStop {
  id: string
  name_ar: string
}

/** The draft-shaped payload the studio loads for editing (`?edit=`). */
export interface StudioDraftPayload {
  id?: number
  city_id: string | null
  name_ar: string
  name_en: string | null
  price: number | null
  notes: string | null
  geojson: unknown
  color_index?: number | null
  colorIndex?: number | null
  route_id?: string | null
  is_published_route?: boolean
}
