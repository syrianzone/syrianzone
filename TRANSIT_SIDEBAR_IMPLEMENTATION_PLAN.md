# Transit Sidebar Unification — Detailed Implementation Plan

## Executive Summary

**Goal**: Replace the current fragmented Transit page structure (separate pages for city list → routes list → route detail → map) with a **single persistent layout** featuring a **URL-driven sidebar** (like the Population page) that shows contextual navigation/filters. All existing URLs must remain shareable and functional.

**Key Requirements**:
1. Unified sidebar at `/transit` level (persistent across city/routes/map)
2. Sidebar content changes based on URL (no SPA navigation breaking deep links)
3. Map page gets filter toolbar: route dropdown + **stops visibility toggle** + legend
4. **Transit Studio button** in header (authenticated users only)
5. **Studio edit mode**: allow dragging existing stops to new locations
6. Zero database changes; zero breaking changes to existing URLs

---

## Current Architecture Analysis (Evidence-Based)

### Existing URL Structure (Must Preserve)

| Route File | URL Pattern | Props Received | Purpose |
|------------|-------------|----------------|---------|
| `Pages/Transit/Index.tsx` | `/transit` | `cities: City[]` | Landing: Hero + CityGrid |
| `Pages/Transit/city/[id]/Index.tsx` | `/transit/city/:cityId` | `id: string` | Routes list (fetches via `useRoutes`) |
| `Pages/Transit/city/[id]/route/[routeId]/Index.tsx` | `/transit/city/:cityId/route/:routeId` | `city, route, stops` | Route detail + stops list |
| `Pages/Transit/city/[id]/map/Index.tsx` | `/transit/city/:cityId/map?route=` | `id: string` | Full-screen map (fetches via `useMapData`) |
| `Pages/Transit/studio/Index.tsx` | `/transit/studio?edit=` | None (client-only) | Submission wizard |

**Evidence**: See `resources/js/Pages/Transit/city/[id]/Index.tsx:15-84`, `route/[routeId]/Index.tsx:9-226`, `map/Index.tsx:16-138`.

### Current Layout

```tsx
// Pages/Transit/layout.tsx:26-42
function TransitRootWrapper({ children }) {
  const { url } = usePage()
  const path = url.split('?')[0]
  const isFullHeight = path.startsWith('/transit/studio') || path.startsWith('/transit/admin') || path.match(/^\/transit\/city\/[^/]+\/map$/)
  return <div className={`transit-root ${isFullHeight ? 'h-full' : 'min-h-svh'}`}>{children}</div>
}
```

**Problem**: Each page re-renders full layout; no persistent sidebar; map is isolated full-screen.

### Population Page Reference (Sidebar Pattern)

`Pages/Population/PopulationClient.tsx:399-437` shows a **left sidebar** (`absolute left-0 top-0 bottom-0 w-full sm:w-80`) with:
- Collapsible via button (`translate-x-0` / `-translate-x-full`)
- Data type selector grid (population, rainfall, environmental)
- Detail panels that slide in on feature click
- Mobile-responsive (auto-opens on desktop, drawer on mobile)

**Key Insight**: Sidebar content is **state-driven**, not route-driven. We need **URL-driven** sidebar for shareability.

### Map Components (Current)

| File | Purpose |
|------|---------|
| `_components/citymap/MapView.tsx` | Composes MapCanvas + RouteLayer + StopsLayer + NearbyTransitDrawer |
| `_components/citymap/RouteLayer.tsx:66-75` | Click handler → `setSelectedRouteId(props.id)` + shows route card modal |
| `_components/citymap/StopsLayer.tsx:45-76` | Click → Popup with stop name + route badges |
| `_store/useMapStore.ts` | `selectedRouteId`, `hoveredStopId`, `mapBounds` |

**Critical**: `RouteLayer` and `StopsLayer` are **independent React components** inside `MapCanvas` — they can read from a shared Zustand store.

### Studio Store (Current)

`Pages/Transit/_store/useStudioStore.ts:11-39`:
```ts
interface StudioState {
  step: WizardStep
  cityId: string
  drawnLine: [number, number][] | null
  stops: StopFeature[]  // { id, coordinates, nameAr }
  // ... meta fields
  isEditMode: boolean
  editingDraftId: number | null
  editingRouteId: string | null
  // Actions: setDrawnLine, addStop, updateStopName, removeStop, loadDraft, reset
}
```

**Evidence**: `loadDraft` (lines 79-111) parses GeoJSON LineString → `drawnLine`, Points → `stops`. Edit mode triggered by `?edit=DRAFT_ID` or `?edit=ROUTE_ID` (studio/Index.tsx:628-647).

**Gap**: No `updateStopCoordinates` action; Step 3 (`Step3Stops` at studio/Index.tsx:212-281) only allows **adding** stops, not moving existing ones.

---

## Implementation Phases

### Phase 1: Foundation — New Layout & Sidebar Shell (Files: 4 new, 1 edit)

#### 1.1 Create `TransitSidebarLayout.tsx` — Root persistent shell

**File**: `resources/js/Pages/Transit/TransitSidebarLayout.tsx` (NEW)

**Reasoning**: Replaces `TransitRootWrapper` logic. Provides:
- Fixed left sidebar (280px desktop, drawer mobile)
- Header with menu toggle + Studio button
- Main content area that fills remaining space
- Handles `h-full` for map/studio/admin vs `min-h-svh` for others

**Code Structure**:
```tsx
'use client'
import { useState, useEffect } from 'react'
import { usePage } from '@inertiajs/react'
import { TransitHeader } from './_components/TransitHeader'
import { TransitSidebar } from './_components/TransitSidebar'

export default function TransitSidebarLayout({ children }: { children: React.ReactNode }) {
  const { url } = usePage()
  const path = url.split('?')[0]
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // Desktop: always open; Mobile: drawer
  useEffect(() => {
    if (!isMobile) setSidebarOpen(true)
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setSidebarOpen(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [isMobile])

  // Routes that DON'T show sidebar (full-screen apps)
  const hideSidebar = path.startsWith('/transit/studio') || path.startsWith('/transit/admin')

  return (
    <div className="transit-shell flex h-full bg-[var(--bg)]">
      {!hideSidebar && (
        <aside className={`
          transit-sidebar fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300
          bg-[var(--surface)] border-r border-[var(--border)]
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          sm:translate-x-0 sm:relative sm:z-auto
        `}>
          <TransitSidebar pathname={path} search={new URLSearchParams(url.split('?')[1] || '')} />
        </aside>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <TransitHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 overflow-auto">{children}</div>
      </main>

      {isMobile && sidebarOpen && !hideSidebar && (
        <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}
    </div>
  )
}
```

**Why**: Single source of truth for layout; sidebar persists across route changes (Inertia preserves layout component).

---

#### 1.2 Create `TransitHeader.tsx` — Header with Studio button

**File**: `resources/js/Pages/Transit/_components/TransitHeader.tsx` (NEW)

**Reasoning**: Current `Header.tsx` returns `null`. Need visible header with:
- Transit branding (link to `/transit`)
- Mobile menu toggle (hamburger)
- **Studio button** (only for authenticated users)
- Theme toggle (optional, but Transit has `TransitThemeContext`)

**Code Structure**:
```tsx
'use client'
import { Link, usePage } from '@inertiajs/react'
import { useAuth } from '@/Contexts/AuthContext'
import { useTransitTheme } from '../_components/TransitThemeContext'
import { Bus, PlusCircle, Sun, Moon, Menu, X } from 'lucide-react'

export function TransitHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTransitTheme()
  const { url } = usePage()
  const path = url.split('?')[0]
  const isLanding = path === '/transit' || path === '/transit/'

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-full items-center justify-between px-4">
        {/* Mobile menu toggle */}
        <button
          onClick={onMenuClick}
          className="sm:hidden p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          aria-label="فتح القائمة"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Brand */}
        <Link
          href="/transit"
          className="flex items-center gap-2 font-bold text-[var(--gold)] hover:opacity-80 transition-opacity"
          aria-label="ترانزيت - الصفحة الرئيسية"
        >
          <Bus className="h-5 w-5" />
          <span className="hidden sm:inline">ترانزيت</span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            aria-label={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
            title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Studio button - authenticated only */}
          {user && (
            <Link
              href="/transit/studio"
              className="flex items-center gap-1.5 rounded-lg bg-[var(--gold)] px-3 py-1.5 text-sm font-bold text-[var(--bg)] hover:bg-[var(--gold)]/90 transition-colors"
              title="إضافة مسار جديد"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">إضافة مسار</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
```

**Why**: Centralizes header logic; Studio button visibility tied to auth; theme toggle accessible everywhere.

---

#### 1.3 Create `TransitSidebar.tsx` — URL-driven content switcher

**File**: `resources/js/Pages/Transit/_components/TransitSidebar.tsx` (NEW)

**Reasoning**: Sidebar content **must derive from URL** (not React state) so deep links work. Uses `pathname` + `searchParams` to decide what to render.

**Code Structure**:
```tsx
'use client'
import { useMemo } from 'react'
import { Link } from '@inertiajs/react'
import citiesData from '../../_data/cities.json'
import { useRoutes, useMapData } from '../../_hooks/useMapData'
import type { City } from '../../_types'
import { SidebarCities } from './SidebarCities'
import { SidebarRoutes } from './SidebarRoutes'
import { SidebarRouteDetail } from './SidebarRouteDetail'
import { SidebarMapTools } from './SidebarMapTools'

const cities = citiesData as City[]

interface TransitSidebarProps {
  pathname: string
  search: URLSearchParams
}

export function TransitSidebar({ pathname, search }: TransitSidebarProps) {
  const cityId = getCityIdFromPath(pathname)
  const routeId = getRouteIdFromPath(pathname)
  const isMap = pathname.includes('/map')

  // Fetch data needed for sidebar (client-side hooks, no server props needed)
  const { data: routes } = useRoutes(cityId)
  const { data: mapData } = useMapData(cityId)

  const city = useMemo(() => cities.find(c => c.id === cityId), [cityId])
  const route = useMemo(() => routes?.features.find(r => r.properties.id === routeId), [routes, routeId])
  const selectedRouteId = search.get('route')

  // URL-driven content switching
  if (pathname === '/transit' || pathname === '/transit/') {
    return <SidebarCities cities={cities} />
  }

  if (cityId && !routeId && !isMap) {
    // /transit/city/:cityId
    return <SidebarRoutes city={city} routes={routes?.features ?? []} />
  }

  if (routeId && !isMap) {
    // /transit/city/:cityId/route/:routeId
    const stops = mapData?.stops.features.filter(f =>
      Array.isArray(f.properties.routeIds) && f.properties.routeIds.includes(routeId)
    ) ?? []
    return <SidebarRouteDetail route={route?.properties} city={city} stops={stops} />
  }

  if (isMap) {
    // /transit/city/:cityId/map
    return <SidebarMapTools
      city={city}
      routes={routes?.features ?? []}
      selectedRouteId={selectedRouteId}
      allStops={mapData?.stops.features ?? []}
    />
  }

  return null // Studio/Admin handled by hideSidebar in layout
}

// Helpers
function getCityIdFromPath(path: string): string | null {
  const match = path.match(/^\/transit\/city\/([^/]+)/)
  return match ? match[1] : null
}
function getRouteIdFromPath(path: string): string | null {
  const match = path.match(/^\/transit\/city\/[^/]+\/route\/([^/]+)/)
  return match ? match[1] : null
}
```

**Why**: Pure function `useRoutes`/`useMapData` are existing hooks (client-side fetches) — no server prop changes needed.

---

#### 1.4 Create Sidebar Content Components (4 new files)

**Files** (all in `resources/js/Pages/Transit/_components/`):

| File | Purpose | Key Features |
|------|---------|--------------|
| `SidebarCities.tsx` | Compact city list for landing | Grid of city cards, click → `/transit/city/:id` |
| `SidebarRoutes.tsx` | Routes list for city | Grouped by Damascus/Rif-Dimashq, shows stops count + price, map button per route |
| `SidebarRouteDetail.tsx` | Route header + scrollable stops list | Route name/color, stops with numbers/names, click stop → pan map (via store) |
| `SidebarMapTools.tsx` | **Map toolbar** (route filter + stops toggle + legend) | Dropdown to select route, toggle stops visibility, quick link to route detail |

** `SidebarMapTools.tsx` — Critical for Stops Toggle**

```tsx
// resources/js/Pages/Transit/_components/SidebarMapTools.tsx
'use client'
import { useState } from 'react'
import { MapPin, MapPinOff, Filter, Layers, Map } from 'lucide-react'
import { Link } from '@inertiajs/react'
import { useMapStore } from '../../_store/useMapStore'

interface SidebarMapToolsProps {
  city: City | undefined
  routes: any[]
  selectedRouteId: string | null
  allStops: any[]
}

export function SidebarMapTools({ city, routes, selectedRouteId, allStops }: SidebarMapToolsProps) {
  const { setSelectedRouteId } = useMapStore()
  const [showStops, setShowStops] = useState(true)

  const handleRouteChange = (routeId: string | null) => {
    setSelectedRouteId(routeId)
    // Update URL without reload for shareability
    const newUrl = routeId
      ? `/transit/city/${city?.id}/map?route=${routeId}`
      : `/transit/city/${city?.id}/map`
    window.history.replaceState({}, '', newUrl)
  }

  const filteredStopsCount = selectedRouteId
    ? allStops.filter(f => Array.isArray(f.properties.routeIds) && f.properties.routeIds.includes(selectedRouteId)).length
    : allStops.length

  return (
    <div className="p-4 space-y-4 h-full flex flex-col">
      {/* Route Filter Dropdown */}
      <div>
        <label className="text-xs font-medium text-[var(--muted)] mb-1 block flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" />
          تصفية المسار
        </label>
        <select
          value={selectedRouteId || ''}
          onChange={e => handleRouteChange(e.target.value || null)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          aria-label="اختر مسارًا لتصفيته"
        >
          <option value="">جميع المسارات ({routes.length})</option>
          {routes.map(r => (
            <option key={r.properties.id} value={r.properties.id}>
              {r.properties.nameAr} ({r.properties.stopsCount ?? 0} موقف)
            </option>
          ))}
        </select>
      </div>

      {/* Stops Toggle — LIKE MISHWAR FILTER BUTTON */}
      <button
        onClick={() => setShowStops(!showStops)}
        className={`
          flex items-center gap-2 w-full px-3 py-2 rounded-lg border transition-colors text-sm font-medium
          ${showStops
            ? 'bg-[var(--gold)]/10 border-[var(--gold)] text-[var(--gold)]'
            : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)]'
          }
        `}
        aria-pressed={showStops}
      >
        {showStops ? <MapPin className="h-4 w-4" /> : <MapPinOff className="h-4 w-4" />}
        <span>المواقف</span>
        <span className="ml-auto text-xs opacity-60">
          {showStops ? `مظهر (${filteredStopsCount})` : 'مخفي'}
        </span>
      </button>

      {/* Quick link to route detail when route selected */}
      {selectedRouteId && city && (
        <Link
          href={`/transit/city/${city.id}/route/${selectedRouteId}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 text-sm font-medium"
        >
          <Layers className="h-4 w-4" />
          عرض تفاصيل المسار
        </Link>
      )}

      {/* Legend — auto-updates based on selection */}
      <div className="mt-auto pt-4 border-t border-[var(--border)]">
        <h4 className="text-xs font-medium text-[var(--muted)] mb-2 flex items-center gap-1">
          <Map className="h-3.5 w-3.5" />
          الأسطورة
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-1 rounded" style={{ background: 'var(--gold)' }} />
            <span className="text-[var(--muted)]">مسار مختار</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-1 rounded" style={{ background: 'var(--border)' }} />
            <span className="text-[var(--muted)]">مسارات أخرى</span>
          </div>
          {showStops && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: '#4a9eff' }} />
              <span className="text-[var(--muted)]">مواقف</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Why**: 
- Route dropdown updates URL via `replaceState` → shareable links work
- Stops toggle mirrors Mishwar filter button pattern (gold when active, muted when off)
- Legend provides visual key for map layers
- All state in `useMapStore` → `StopsLayer` and `RouteLayer` react automatically

---

#### 1.5 Edit `layout.tsx` — Use new sidebar layout

**File**: `resources/js/Pages/Transit/layout.tsx` (EDIT)

**Change**: Replace `TransitRootWrapper` with `TransitSidebarLayout`

```tsx
// BEFORE (lines 26-42)
function TransitRootWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useTransitTheme()
  const { url } = usePage()
  const path = url.split('?')[0]
  const isFullHeight = path.startsWith('/transit/studio') || path.startsWith('/transit/admin') || path.match(/^\/transit\/city\/[^/]+\/map$/) !== null
  return <div className={`transit-root ${isFullHeight ? 'h-full' : 'min-h-svh'}`} data-transit-theme={theme}>{children}</div>
}

// AFTER
import TransitSidebarLayout from './TransitSidebarLayout'

export default function TransitLayout({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout>
      <QueryProvider>
        <TransitThemeProvider>
          <TransitSidebarLayout>
            {children}
          </TransitSidebarLayout>
        </TransitThemeProvider>
      </QueryProvider>
    </MainLayout>
  )
}
```

**Why**: Single layout entry point; `TransitSidebarLayout` handles full-height logic internally.

---

### Phase 2: Map Integration — Stops Toggle & Store Updates (Files: 2 edit, 1 new)

#### 2.1 Edit `useMapStore.ts` — Add `showStops` state

**File**: `resources/js/Pages/Transit/_store/useMapStore.ts` (EDIT)

```ts
import { create } from 'zustand'

interface MapState {
  selectedRouteId: string | null
  hoveredStopId: string | null
  mapBounds: [[number, number], [number, number]] | null
  // NEW: stops visibility
  showStops: boolean
  setSelectedRouteId: (id: string | null) => void
  setHoveredStopId: (id: string | null) => void
  setMapBounds: (bounds: [[number, number], [number, number]] | null) => void
  // NEW
  setShowStops: (show: boolean) => void
}

export const useMapStore = create<MapState>((set) => ({
  selectedRouteId: null,
  hoveredStopId: null,
  mapBounds: null,
  showStops: true, // default visible
  setSelectedRouteId: (id) => set({ selectedRouteId: id }),
  setHoveredStopId: (id) => set({ hoveredStopId: id }),
  setMapBounds: (bounds) => set({ mapBounds: bounds }),
  setShowStops: (show) => set({ showStops: show }),
}))
```

**Why**: Single source of truth for map UI state; `SidebarMapTools` writes, `StopsLayer` reads.

---

#### 2.2 Edit `StopsLayer.tsx` — React to `showStops`

**File**: `resources/js/Pages/Transit/_components/citymap/StopsLayer.tsx` (EDIT)

```tsx
// Add import
import { useMapStore } from '../../_store/useMapStore'

// Inside component, after map initialization effect:
const showStops = useMapStore(s => s.showStops)

useEffect(() => {
  if (!map) return
  if (map.getLayer('stops-circle')) {
    map.setLayoutProperty('stops-circle', 'visibility', showStops ? 'visible' : 'none')
  }
}, [map, showStops])

// Also ensure layer ID matches (currently 'stops-circle' line 24)
```

**Why**: MapLibre layer visibility toggle is instant; no re-fetch needed.

---

#### 2.3 Edit `RouteLayer.tsx` — Highlight selected route (already works via store)

**File**: `resources/js/Pages/Transit/_components/citymap/RouteLayer.tsx` (NO CHANGE NEEDED)

**Verification**: Lines 103-118 already read `selectedRouteId` from store and adjust opacity/width. Sidebar dropdown calls `setSelectedRouteId` → works automatically.

---

### Phase 3: Studio Enhancements (Files: 2 edit)

#### 3.1 Edit `useStudioStore.ts` — Add `updateStopCoordinates`

**File**: `resources/js/Pages/Transit/_store/useStudioStore.ts` (EDIT)

```ts
// In StopFeature interface (line 3-7)
export interface StopFeature {
  id: number
  coordinates: [number, number]
  nameAr: string
  // NEW: optional, for drag feedback
  isDragging?: boolean
}

// In StudioState interface (add after line 33)
updateStopCoordinates: (id: number, coords: [number, number]) => void

// In create() set() (add after line 73)
updateStopCoordinates: (id, coords) =>
  set((state) => ({
    stops: state.stops.map((s) => (s.id === id ? { ...s, coordinates: coords } : s)),
  })),
```

**Why**: Enables dragging existing stops in edit mode; minimal state change.

---

#### 3.2 Edit `studio/Index.tsx` — Draggable stops in Step 3 (Edit Mode)

**File**: `resources/js/Pages/Transit/studio/Index.tsx` (EDIT)

**Location**: In `Step3Stops` component (around line 212-281) — add effect for draggable markers when `isEditMode && stops.length > 0`.

**Add after line 567 (mapReady state)**:
```tsx
const stopMarkersRef = useRef<maplibregl.Marker[]>([])
```

**Add new effect (after line 1026, before mobile detection)**:
```tsx
// ─── Draggable stop markers for EDIT MODE ─────────────────────────────────────
useEffect(() => {
  if (!mapReady || !mapRef.current || !isEditMode) return
  const map = mapRef.current

  // Clear existing stop markers
  stopMarkersRef.current.forEach(m => m.remove())
  stopMarkersRef.current = []

  if (!stops.length) return

  stops.forEach((stop) => {
    const el = document.createElement('div')
    el.className = 'studio-stop-handle'
    el.style.cssText = `
      width:20px;height:20px;border-radius:50%;
      background:#4a9eff;border:2px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
      cursor:grab;touch-action:none;
      transition:transform 0.1s, box-shadow 0.1s;
    `
    el.dataset.stopId = String(stop.id)

    const marker = new maplibregl.Marker({ element: el, draggable: true, offset: [0, -10] })
      .setLngLat(stop.coordinates as maplibregl.LngLatLike)
      .addTo(map)

    marker.on('dragstart', () => {
      el.style.transform = 'scale(1.3)'
      el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)'
      el.style.cursor = 'grabbing'
      // Optional: highlight in store for UI feedback
      useStudioStore.setState(state => ({
        stops: state.stops.map(s => s.id === stop.id ? { ...s, isDragging: true } : s)
      }))
    })

    marker.on('dragend', () => {
      el.style.transform = 'scale(1)'
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
      el.style.cursor = 'grab'
      const pos = marker.getLngLat()
      const newCoord: [number, number] = [pos.lng, pos.lat]
      useStudioStore.getState().updateStopCoordinates(stop.id, newCoord)
      useStudioStore.setState(state => ({
        stops: state.stops.map(s => s.id === stop.id ? { ...s, isDragging: false } : s)
      }))
    })

    // Tooltip on hover
    el.title = `اسحب لنقل "${stop.nameAr || 'محطة بدون اسم'}"`

    stopMarkersRef.current.push(marker)
  })

  return () => {
    stopMarkersRef.current.forEach(m => m.remove())
    stopMarkersRef.current = []
  }
}, [mapReady, stops, isEditMode])
```

**Also**: In `Step3Stops` JSX (around line 245-268), add visual indicator for edit mode:
```tsx
{isEditMode && stops.length > 0 && (
  <p className="studio-hint text-[var(--gold)] mb-3 flex items-center gap-1">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
    </svg>
    <span>وضع التعديل: اسحب المحطات على الخريطة لتغيير مواقعها</span>
  </p>
)}
```

**Why**: 
- Only activates in `isEditMode` (loaded via `?edit=` param)
- Uses same `maplibregl.Marker` pattern as vertex handles (lines 957-1014)
- Updates store → `loadDraft` on submit includes new coordinates in GeoJSON
- Backend PUT `/api/v1/studio/routes/:id` already accepts full GeoJSON with updated stops

---

### Phase 4: Route File Updates — Adopt New Layout (Files: 4 edit)

Each route file must **remove its own Header/Layout wrapper** since `TransitSidebarLayout` provides them.

#### 4.1 Edit `Pages/Transit/Index.tsx` — Remove Header import (unused)

**File**: `resources/js/Pages/Transit/Index.tsx` (EDIT)

```tsx
// REMOVE: import Header from './_components/layout/Header' (line 3)
// REMOVE: <Header /> from JSX (line 41)
// KEEP: <TransitLayout> wrapper (line 10) — now uses new layout
```

**Why**: Header now in `TransitSidebarLayout`; landing page gets sidebar with city list.

---

#### 4.2 Edit `Pages/Transit/city/[id]/Index.tsx` — Remove Header, keep content

**File**: `resources/js/Pages/Transit/city/[id]/Index.tsx` (EDIT)

```tsx
// REMOVE: import Header from '../../_components/layout/Header' (line 3)
// REMOVE: <Header /> (line 41)
// KEEP: Everything else inside <main> — RoutesList already fetches own data
```

**Why**: Sidebar shows `SidebarRoutes` (route list); main content shows `RoutesList` (same data, different presentation).

---

#### 4.3 Edit `Pages/Transit/city/[id]/route/[routeId]/Index.tsx` — Remove Header

**File**: `resources/js/Pages/Transit/city/[id]/route/[routeId]/Index.tsx` (EDIT)

```tsx
// REMOVE: import Header from '../../../../_components/layout/Header' (line 3)
// REMOVE: <Header /> (line 54)
// KEEP: All route detail + stops list content
```

**Why**: Sidebar shows `SidebarRouteDetail` (compact stops list); main shows full detail.

---

#### 4.4 Edit `Pages/Transit/city/[id]/map/Index.tsx` — Remove Header, OfflineBanner

**File**: `resources/js/Pages/Transit/city/[id]/map/Index.tsx` (EDIT)

```tsx
// REMOVE: import Header from '../../../_components/layout/Header' (line 5)
// REMOVE: import OfflineBanner from '../../../_components/citymap/OfflineBanner' (line 6)
// REMOVE: <Header /> (line 82)
// REMOVE: {isOffline && <OfflineBanner />} (line 83)
// KEEP: MapView inside Suspense — now fills main content area
```

**Why**: 
- Header in sidebar layout
- Offline banner: either move to `MapView` component or add to sidebar (future)
- Map now has sidebar with filters; main area is map canvas

---

### Phase 5: Cleanup & Verification (Files: 1 delete, 1 edit)

#### 5.1 Delete `Header.tsx` — No longer used

**File**: `resources/js/Pages/Transit/_components/layout/Header.tsx` (DELETE)

**Verification**: `grep -r "from.*Header" --include="*.tsx" resources/js/Pages/Transit` returns no results after Phase 4 edits.

---

#### 5.2 Edit `transit.css` — Ensure sidebar z-index & transitions

**File**: `resources/js/Pages/Transit/transit.css` (EDIT — add if missing)

```css
/* Sidebar transitions */
.transit-sidebar {
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.transit-shell {
  min-height: 100vh;
}

/* Map full height inside main */
.transit-shell main > .flex-1 {
  height: 100%;
}

/* Mobile drawer overlay */
@media (max-width: 767px) {
  .transit-sidebar {
    box-shadow: 0 0 40px rgba(0,0,0,0.3);
  }
}
```

**Why**: Ensures smooth sidebar animation; map fills viewport.

---

## File Summary

### New Files (9)

| File | Phase | Purpose |
|------|-------|---------|
| `Pages/Transit/TransitSidebarLayout.tsx` | 1.1 | Root persistent layout with sidebar |
| `Pages/Transit/_components/TransitHeader.tsx` | 1.2 | Header with Studio button + theme toggle |
| `Pages/Transit/_components/TransitSidebar.tsx` | 1.3 | URL-driven sidebar content router |
| `Pages/Transit/_components/SidebarCities.tsx` | 1.4 | Compact city grid for landing |
| `Pages/Transit/_components/SidebarRoutes.tsx` | 1.4 | Routes list with map buttons |
| `Pages/Transit/_components/SidebarRouteDetail.tsx` | 1.4 | Route header + scrollable stops |
| `Pages/Transit/_components/SidebarMapTools.tsx` | 1.4 | **Map toolbar: route filter + stops toggle + legend** |
| `Pages/Transit/_store/useMapStore.ts` (edit) | 2.1 | Add `showStops` state |
| `Pages/Transit/_components/citymap/StopsLayer.tsx` (edit) | 2.2 | React to `showStops` |

### Edited Files (8)

| File | Phase | Change |
|------|-------|--------|
| `Pages/Transit/layout.tsx` | 1.5 | Use `TransitSidebarLayout` |
| `Pages/Transit/Index.tsx` | 4.1 | Remove Header |
| `Pages/Transit/city/[id]/Index.tsx` | 4.2 | Remove Header |
| `Pages/Transit/city/[id]/route/[routeId]/Index.tsx` | 4.3 | Remove Header |
| `Pages/Transit/city/[id]/map/Index.tsx` | 4.4 | Remove Header + OfflineBanner |
| `Pages/Transit/_store/useStudioStore.ts` | 3.1 | Add `updateStopCoordinates` |
| `Pages/Transit/studio/Index.tsx` | 3.2 | Draggable stop markers in edit mode |
| `Pages/Transit/transit.css` | 5.2 | Sidebar transitions |

### Deleted Files (1)

| File | Phase | Reason |
|------|-------|--------|
| `Pages/Transit/_components/layout/Header.tsx` | 5.1 | Replaced by `TransitHeader` in layout |

---

## Testing Checklist (No Code Execution — Manual Verification)

### URL Shareability (Critical)

| Test Case | Expected |
|-----------|----------|
| Open `/transit/city/damascus` → copy URL → open in new tab | Shows Damascus routes in sidebar + main |
| Open `/transit/city/damascus/route/123` → share link | Opens route detail with stops in sidebar |
| Open `/transit/city/damascus/map?route=123` → share | Map focused on route 123, sidebar shows route selected, stops visible |
| Toggle stops in sidebar → copy URL → open new tab | **Stops state NOT in URL** (UI preference), but route filter IS in URL |
| `/transit/studio?edit=456` → share | Opens studio in edit mode (no sidebar) |

### Sidebar Behavior

| Scenario | Desktop | Mobile |
|----------|---------|--------|
| Landing (`/transit`) | Sidebar open, city list | Drawer closed, hamburger opens |
| City routes | Sidebar open, routes list | Drawer closed |
| Route detail | Sidebar open, stops list | Drawer closed |
| Map | Sidebar open, filters + toggle | Drawer closed |
| Studio | **No sidebar** (full screen) | **No sidebar** |

### Map Functionality

- [ ] Route dropdown filters map + updates URL
- [ ] Stops toggle shows/hides stops layer instantly
- [ ] Legend updates when route selected / stops toggled
- [ ] Click route on map → highlights + sidebar shows route selected
- [ ] Click stop on map → popup works (unchanged)
- [ ] NearbyTransitDrawer still works (bottom sheet, independent)

### Studio Edit Mode

- [ ] Open `/transit/studio?edit=DRAFT_ID` → loads draft, shows existing stops on map
- [ ] Step 3: Stops have draggable markers (blue handles)
- [ ] Drag stop → marker follows, store updates
- [ ] Submit → GeoJSON includes new stop coordinates
- [ ] New submission (no edit param) → Step 3 works as before (add stops only)

### Authentication

- [ ] Unauthenticated: No Studio button in header
- [ ] Authenticated: Studio button visible, links to `/transit/studio`

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Inertia layout persistence breaks on navigation | Low | High | Test `TransitSidebarLayout` wraps all routes; Inertia preserves layout component |
| `useRoutes`/`useMapData` hooks cause double-fetch | Medium | Low | Hooks use React Query caching; sidebar + main share cache |
| Map height issues (sidebar + map full height) | Medium | Medium | `TransitSidebarLayout` main is `flex-1`; map page uses `h-full` inside |
| Studio edit mode breaks new submissions | Low | High | `isEditMode` guard on draggable markers; only active when `editingDraftId` or `editingRouteId` set |
| Mobile sidebar UX | Medium | Medium | Copy Population page pattern: hamburger → drawer overlay |

---

## Rollback Plan

If issues arise:
1. Revert `layout.tsx` to use `TransitRootWrapper`
2. Restore `Header.tsx` imports in 4 route files
3. Delete 9 new sidebar files
4. Revert `useMapStore` and `StopsLayer` changes
5. Revert `useStudioStore` and `studio/Index.tsx` changes

All changes are **additive/isolated** — no database migrations, no API changes.

---

## Estimated Effort

| Phase | Files | Complexity | Est. Hours |
|-------|-------|------------|------------|
| 1: Foundation | 5 new, 1 edit | Medium | 4-6 |
| 2: Map Integration | 2 edit, 1 new | Low | 1-2 |
| 3: Studio | 2 edit | Medium | 2-3 |
| 4: Route Updates | 4 edit | Low | 1-2 |
| 5: Cleanup | 1 delete, 1 edit | Low | 0.5 |
| **Total** | **18 files** | | **8.5-13.5 hrs** |

---

## Appendix: Key Code References

| Concept | File:Line |
|---------|-----------|
| Current layout full-height logic | `Pages/Transit/layout.tsx:30-33` |
| Population sidebar pattern | `Pages/Population/PopulationClient.tsx:399-437` |
| Studio store `loadDraft` | `Pages/Transit/_store/useStudioStore.ts:79-111` |
| Studio edit mode detection | `Pages/Transit/studio/Index.tsx:628-647` |
| Vertex drag handles (pattern) | `Pages/Transit/studio/Index.tsx:957-1014` |
| RouteLayer highlight | `Pages/Transit/_components/citymap/RouteLayer.tsx:103-118` |
| StopsLayer popup | `Pages/Transit/_components/citymap/StopsLayer.tsx:45-76` |
| NearbyTransitDrawer (mobile pattern) | `Pages/Transit/_components/citymap/NearbyTransitDrawer.tsx:143-196` |
| Map store | `Pages/Transit/_store/useMapStore.ts:1-19` |
| City data | `Pages/Transit/_data/cities.json:1-142` |

---

## Sign-Off Criteria

- [ ] All 6 existing URLs work identically (visual diff only: sidebar added)
- [ ] Map route filter updates URL and filters map
- [ ] Stops toggle shows/hides stops instantly
- [ ] Studio button appears for authenticated users only
- [ ] Studio edit mode allows dragging existing stops
- [ ] Mobile: sidebar is drawer, map works, studio full-screen
- [ ] No console errors; TypeScript compiles
- [ ] Lint passes (`npm run lint` or project equivalent)