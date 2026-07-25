# Map Refactoring Plan

## Goal

1. Break down mishwar's monolithic `PlacesMap.tsx` into composable layer components
2. Switch transit from raster to vector tile basemaps
3. Fix Arabic/RTL text rendering on both maps

---

## Problem Analysis

### RTL Issue — Mishwar (letters disconnected and reversed)

**Root cause:** The RTL plugin IS loaded (`PlacesMap.tsx:11-13`), fonts ARE self-hosted (`public/fonts/map/IBM Plex Sans Arabic/`), BUT:
- The vector styles use `{name_en}` for most text-field layers — pulling English names from OSM, not Arabic
- The RTL plugin only shapes text that contains RTL characters. If the text-field resolves to English (`{name_en}`), the plugin has nothing to shape
- For layers that DO use `{name}`, the fonts are correct but the glyph PBF ranges may not cover all characters used in Syrian place names
- The cluster count labels use `text-font: ['IBM Plex Sans Arabic Bold']` which IS correct — these render fine

**Fix:** In the vector style JSON files, change text-field expressions from `{name_en}` to `{name}` (or a coalesce expression) so Arabic names render. The RTL plugin + self-hosted fonts will then handle shaping correctly.

### RTL Issue — Transit (fallback font)

**Root cause:** Transit uses raster tiles (`dark-matter.json`, `positron.json`) where labels are pre-baked into PNG tiles by CARTO's servers. CARTO's raster tiles use their own fonts for labels — not the self-hosted IBM Plex Sans Arabic. The `glyphs` URL in raster styles points to `demotiles.maplibre.org` which has NO Arabic glyphs at all.

**Fix:** Switch transit to vector tiles. The vector styles reference the self-hosted IBM Plex Sans Arabic fonts and the RTL plugin handles shaping. CARTO's vector tiles carry `{name}` (local name) in the data, so Arabic labels appear correctly.

---

## Part 1: Fix RTL on Both Maps

### 1A. Update Vector Style Text Fields

**Files:** `public/styles/styles/dark-matter-vector.json`, `public/styles/styles/light-vector.json`

The vector styles have ~27 symbol layers. Most use `{"text-field": "{name_en}"}`. These need to change to use the local name.

**Change:** For every `text-field` property, replace:
```json
"text-field": "{name_en}"
```
with a coalesce expression that prefers the local name:
```json
"text-field": ["coalesce", ["get", "name:ar"], ["get", "name"], ""]
```

Or simpler, if we want Arabic-first labels:
```json
"text-field": "{name}"
```

**Impact:** No database changes. No page structure changes. Only the two style JSON files change.

**Verification:** After the change, open the mishwar map and verify Arabic labels appear on the basemap (city names, road names, POI names).

### 1B. Switch Transit to Vector Styles

**Files to modify:**
- `resources/js/Pages/Transit/_components/citymap/MapCanvas.tsx` — change style URLs
- `resources/js/Pages/Transit/_components/TransitThemeContext.tsx` — update theme mapping

**Change in `MapCanvas.tsx`:**
```tsx
// Before:
const style = theme === 'jasmine' ? '/styles/styles/positron.json' : '/styles/styles/dark-matter.json';

// After:
const style = theme === 'jasmine' ? '/styles/styles/light-vector.json' : '/styles/styles/dark-matter-vector.json';
```

**Change in `TransitThemeContext.tsx`:** No change needed — it just provides the theme name, the style resolution happens in MapCanvas.

**Impact:**
- Transit map now renders vector tiles with Arabic labels
- The `glyphs` URL in vector styles points to self-hosted PBFs with IBM Plex Sans Arabic
- RTL text plugin must be loaded for transit too (handled by shared `useRTLPlugin` in Part 2)
- The vector styles are ~5800 lines vs ~30 lines for raster — larger initial payload but cached by browser
- CARTO vector tiles are still loaded from the same CDN, just vector instead of raster

### 1C. Ensure RTL Plugin Loads for Both Maps

**Current state:** Only `PlacesMap.tsx` loads the plugin. Transit doesn't.

**After Part 2 (shared infrastructure):** The plugin loads once via `useRTLPlugin()` in the shared `MapProvider`. Both maps inherit it.

**Before Part 2 (interim):** Add the same RTL plugin loading to transit's `MapCanvas.tsx`:
```tsx
if (maplibregl.getRTLTextPluginStatus() === 'unloaded') {
  maplibregl.setRTLTextPlugin('/styles/mapbox-gl-rtl-text.min.js', true);
}
```

---

## Part 2: Shared Map Infrastructure

### New directory: `resources/js/Components/map/`

### 2A. `resources/js/Components/map/MapContext.ts` (NEW)

Shared React context for the map instance. Replaces transit's `MapContext.ts`.

```tsx
import { createContext, useContext } from 'react';
import type maplibregl from 'maplibre-gl';

const MapContext = createContext<maplibregl.Map | null>(null);
export const MapProvider = MapContext.Provider;
export function useMap(): maplibregl.Map {
  const map = useContext(MapContext);
  if (!map) throw new Error('useMap must be used within a MapProvider');
  return map;
}
```

### 2B. `resources/js/Components/map/useRTLPlugin.ts` (NEW)

Loads the RTL text plugin exactly once globally.

```tsx
import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';

let loaded = false;

export function useRTLPlugin(): void {
  useEffect(() => {
    if (loaded) return;
    if (maplibregl.getRTLTextPluginStatus() === 'unloaded') {
      maplibregl.setRTLTextPlugin('/styles/mapbox-gl-rtl-text.min.js', true);
    }
    loaded = true;
  }, []);
}
```

### 2C. `resources/js/Components/map/resolveStyle.ts` (NEW)

Maps a global theme ID to the correct vector basemap style path.

```tsx
import { THEME_REGISTRY } from '@/Lib/theme';

const VECT STYLES = {
  dark: '/styles/styles/dark-matter-vector.json',
  light: '/styles/styles/light-vector.json',
};

export function resolveBasemapStyle(themeId?: string | null): string {
  const id = themeId ?? document.documentElement.getAttribute('data-theme');
  const dark = THEME_REGISTRY.find((t) => t.id === id)?.isDark ?? true;
  return dark ? VECT STYLES.dark : VECT STYLES.light;
}
```

### 2D. `resources/js/Components/map/MapCanvas.tsx` (NEW)

Shared map canvas that creates the MapLibre instance, provides context, and handles theme switching. Both mishwar and transit wrap their layer components in this.

```tsx
function MapCanvas(props: {
  children: ReactNode;
  center: [number, number];
  zoom: number;
  maxBounds?: LngLatBoundsLike;
  minZoom?: number;
  maxZoom?: number;
  attributionPosition?: 'bottom-left' | 'bottom-right';
  onMapReady?: (map: maplibregl.Map) => void;
}): JSX.Element
```

**Responsibilities:**
- Creates `maplibregl.Map` with `resolveBasemapStyle()` as initial style
- Calls `useRTLPlugin()`
- Provides `MapProvider` context to children
- Observes `data-theme` mutations and calls `map.setStyle()` on change
- Re-adds sources/layers after `style.load` via a callback pattern (since layers are managed by child components)
- Renders `<div ref={containerRef}>` with full size

**Key difference from current implementations:** After `setStyle()`, the map fires `style.load` which wipes all custom sources/layers. The child layer components must re-add themselves. This is already how both maps work — each layer's `useEffect` checks `if (m.getSource(SOURCE_ID)) return` before adding.

### 2E. `resources/js/Components/map/FlyTo.tsx` (NEW)

A utility component that calls `map.flyTo()` when props change. Used by both maps for focus/zoom behavior.

```tsx
function FlyTo(props: {
  lng: number;
  lat: number;
  zoom?: number;
  key: number; // triggers re-fly on change
}): null
```

Extracted from `PlacesMap.tsx:205-210` and transit's `FitToRoutes.tsx`.

---

## Part 3: Mishwar Component Breakdown

### Current: `PlacesMap.tsx` (327 lines, monolithic)

### Target: Composable layers

```
MapCanvas (shared)
  ├── PlacesLayer      — places GeoJSON source + 3 layers (clusters, count, pin)
  ├── HotelsLayer       — hotels GeoJSON source + 3 layers (clusters, count, pin)
  ├── MapInteractions   — click handlers, cursor management
  ├── FlyTo             — focus/zoom controller
  └── HighlightMarker   — temporary highlight marker
```

### New/modified files

#### 3A. `resources/js/Pages/Places/_components/PlacesLayer.tsx` (NEW, ~80 lines)

Extracted from PlacesMap lines 72-118 (places source + layers).

```tsx
function PlacesLayer(props: {
  data: GeoJSON.FeatureCollection;
  selectedId: number | null;
  onPinClick: (id: number) => void;
}): null
```

**Logic:**
- `useMap()` to get map instance
- `useEffect`: adds `places` source with clustering, adds `clusters`, `cluster-count`, `place-pin` layers
- Cleanup: removes source + layers
- `useEffect([data])`: calls `setData()` on the source
- `useEffect([selectedId])`: updates `circle-radius` paint property on `place-pin`
- Click handler on `place-pin` layer → calls `props.onPinClick(id)`
- Click handler on `clusters` → zooms into cluster

#### 3B. `resources/js/Pages/Places/_components/HotelsLayer.tsx` (NEW, ~80 lines)

Identical structure to PlacesLayer but for hotels with ember color.

```tsx
function HotelsLayer(props: {
  data: GeoJSON.FeatureCollection;
  selectedId: number | null;
  onPinClick: (id: number) => void;
}): null
```

#### 3C. `resources/js/Pages/Places/_components/MapInteractions.tsx` (NEW, ~60 lines)

Handles click-on-empty-map and cursor management.

```tsx
function MapInteractions(props: {
  addMode: boolean;
  onMapClick: (point: LatLng) => void;
}): null
```

**Logic:**
- Click on empty area → `props.onMapClick({ lng, lat })`
- Cursor: crosshair when `addMode`, default otherwise
- Hover on `clusters`/`place-pin`/`hotel-clusters`/`hotel-pin` → pointer cursor

#### 3D. `resources/js/Pages/Places/_components/HighlightMarker.tsx` (NEW, ~25 lines)

Extracted from PlacesMap lines 212-226.

```tsx
function HighlightMarker(props: { point: LatLng | null }): null
```

#### 3E. `resources/js/Pages/Places/_components/PlacesMap.tsx` (REWRITE, ~60 lines)

Becomes a thin composition wrapper:

```tsx
export function PlacesMap(props: {
  features: PlaceFeatureCollection;
  hotelFeatures: HotelFeatureCollection;
  selectedId: number | null;
  selectedType: 'place' | 'hotel' | null;
  addMode: boolean;
  focus: { lng: number; lat: number; zoom?: number; key: number } | null;
  highlight: LatLng | null;
  onPinClick: (id: number) => void;
  onHotelPinClick: (id: number) => void;
  onMapClick: (point: LatLng) => void;
  className?: string;
}) {
  return (
    <div className={props.className}>
      <MapCanvas center={[38.0, 35.0]} zoom={6.2}>
        <PlacesLayer data={props.features} selectedId={props.selectedType === 'place' ? props.selectedId : null} onPinClick={props.onPinClick} />
        <HotelsLayer data={props.hotelFeatures} selectedId={props.selectedType === 'hotel' ? props.selectedId : null} onPinClick={props.onHotelPinClick} />
        <MapInteractions addMode={props.addMode} onMapClick={props.onMapClick} />
        {props.focus && <FlyTo lng={props.focus.lng} lat={props.focus.lat} zoom={props.focus.zoom} key={props.focus.key} />}
        <HighlightMarker point={props.highlight} />
      </MapCanvas>
    </div>
  );
}
```

---

## Part 4: Transit Map Migration

### 4A. Refactor `MapCanvas.tsx` → use shared `MapCanvas`

**File:** `resources/js/Pages/Transit/_components/citymap/MapCanvas.tsx`

Replace the current 119-line file with a thin wrapper around the shared `MapCanvas`:

```tsx
function TransitMapCanvas(props: {
  children: ReactNode;
  city: City;
}): JSX.Element {
  return (
    <SharedMapCanvas
      center={[city.center_lng, city.center_lat]}
      zoom={city.zoom ?? 10}
      maxBounds={/* compute from city bounds */}
      minZoom={8}
      maxZoom={18}
    >
      {props.children}
    </SharedMapCanvas>
  );
}
```

### 4B. Delete `resources/js/Pages/Transit/_components/citymap/MapContext.ts`

Replaced by shared `resources/js/Components/map/MapContext.ts`. Update all imports in:
- `RouteLayer.tsx`
- `StopsLayer.tsx`
- `UserLocationLayer.tsx`
- `NearbyTransitDrawer.tsx`
- `GlobalSearchBox.tsx`

### 4C. Update transit layer components

Each layer component currently does:
```tsx
import { useMap } from '../citymap/MapContext';
```

Change to:
```tsx
import { useMap } from '@/Components/map/MapContext';
```

No other changes needed — the layer pattern (useEffect + source/layer management) stays the same.

### 4D. Studio and Admin maps

**Files:**
- `resources/js/Pages/Transit/studio/Index.tsx` — has its own MapLibre init (~80 lines)
- `resources/js/Pages/Transit/admin/Index.tsx` — has its own MapLibre init (~80 lines)

Replace their inline map init with the shared `MapCanvas`. This eliminates ~160 lines of duplicated map initialization code.

### 4E. Delete `resources/js/Pages/Transit/_components/citymap/MapCanvas.tsx`

After studio and admin are migrated, the old transit MapCanvas is no longer needed.

---

## Part 5: Cleanup

### 5A. Remove old raster style files

**Files to delete:**
- `public/styles/styles/dark-matter.json`
- `public/styles/styles/positron.json`
- `public/styles/styles/light.json`

These are only used by transit (now switched to vector). No other references.

### 5B. Update transit CSS

**File:** `resources/js/Pages/Transit/transit.css`

Remove any raster-specific CSS overrides if they exist. The vector basemap has different DOM structure for labels.

---

## Files Summary

### New files (9)
| File | Purpose |
|------|---------|
| `resources/js/Components/map/MapContext.ts` | Shared map context + useMap hook |
| `resources/js/Components/map/useRTLPlugin.ts` | One-time RTL plugin loader |
| `resources/js/Components/map/resolveStyle.ts` | Theme → vector style resolver |
| `resources/js/Components/map/MapCanvas.tsx` | Shared map canvas + providers |
| `resources/js/Components/map/FlyTo.tsx` | Shared flyTo utility component |
| `resources/js/Pages/Places/_components/PlacesLayer.tsx` | Places GeoJSON layer |
| `resources/js/Pages/Places/_components/HotelsLayer.tsx` | Hotels GeoJSON layer |
| `resources/js/Pages/Places/_components/MapInteractions.tsx` | Click + cursor handlers |
| `resources/js/Pages/Places/_components/HighlightMarker.tsx` | Temporary highlight marker |

### Modified files (12)
| File | Change |
|------|--------|
| `public/styles/styles/dark-matter-vector.json` | Change `{name_en}` → `{name}` in text-fields |
| `public/styles/styles/light-vector.json` | Change `{name_en}` → `{name}` in text-fields |
| `resources/js/Pages/Places/_components/PlacesMap.tsx` | Rewrite as thin composition wrapper |
| `resources/js/Pages/Transit/_components/citymap/MapCanvas.tsx` | Replace with shared MapCanvas wrapper |
| `resources/js/Pages/Transit/_components/citymap/RouteLayer.tsx` | Update import path for useMap |
| `resources/js/Pages/Transit/_components/citymap/StopsLayer.tsx` | Update import path for useMap |
| `resources/js/Pages/Transit/_components/citymap/UserLocationLayer.tsx` | Update import path for useMap |
| `resources/js/Pages/Transit/_components/citymap/NearbyTransitDrawer.tsx` | Update import path for useMap |
| `resources/js/Pages/Transit/_components/citymap/GlobalSearchBox.tsx` | Update import path for useMap |
| `resources/js/Pages/Transit/studio/Index.tsx` | Replace inline map init with shared MapCanvas |
| `resources/js/Pages/Transit/admin/Index.tsx` | Replace inline map init with shared MapCanvas |
| `resources/js/Pages/Transit/_components/citymap/MapView.tsx` | Update imports |

### Deleted files (4)
| File | Reason |
|------|--------|
| `resources/js/Pages/Transit/_components/citymap/MapContext.ts` | Replaced by shared MapContext |
| `public/styles/styles/dark-matter.json` | Raster style, no longer used |
| `public/styles/styles/positron.json` | Raster style, no longer used |
| `public/styles/styles/light.json` | Duplicate raster style, no longer used |

### Database changes
None.

### Page structure changes
None. URLs, routes, Inertia pages stay the same.

---

## Implementation Order

1. Fix RTL text fields in vector styles (1A) — instant fix for mishwar Arabic labels
2. Add RTL plugin loading to transit (1C interim) — enables Arabic text when we switch
3. Switch transit to vector styles (1B) — transit gets Arabic labels
4. Create shared map infrastructure (Part 2) — MapContext, useRTLPlugin, resolveStyle, MapCanvas, FlyTo
5. Break down PlacesMap into layers (Part 3) — composable architecture
6. Migrate transit to shared MapCanvas (Part 4) — eliminate duplication
7. Cleanup raster styles and old MapContext (Part 5)

Steps 1-3 can be deployed independently as a quick fix. Steps 4-7 are the structural refactor.
