/**
 * The transit shapes more than one feature reads: the dashboard moderates the
 * same route drafts the transit admin reviews, and the shell lists the cities
 * the transit pages map.
 */

/** Where a route draft sits in moderation. */
export type DraftStatus = 'pending' | 'approved' | 'rejected'

/**
 * A route draft as both listings send it: `DashboardController`'s
 * `DRAFT_LIST_COLUMNS` and the admin queue's draft row. The drawn geometry is
 * deliberately absent — it is fetched per draft by the admin detail and the
 * studio, never carried by a list. Clients that load more (the admin queue's
 * contributor and linked route) extend this row.
 */
export interface RouteDraftRow {
  id: number
  user_id: number | null
  city_id: string
  /** The published route a draft proposes to replace, if any. */
  route_id: string | null
  /** The city relation both listings eager-load. */
  city: { name_ar: string; name_en: string } | null
  name_ar: string
  name_en: string | null
  price: number | null
  notes: string | null
  status: DraftStatus
  rejection_reason: string | null
  color_index: number | null
  created_at: string
}

/**
 * The city fields the surfaces outside the map read: the search palette's city
 * group and the 404 grid's cards. The rideable count is the table's, so a city
 * with no published route says "قريباً" instead of offering a dead link.
 */
export interface TransitCity {
  id: string
  nameAr: string
  nameEn: string
  status: 'active' | 'coming_soon'
  routeCount: number
}
