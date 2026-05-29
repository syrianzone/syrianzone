# Syrian Zone: Transit Module Deep Dive Map

This document maps out the architecture of the **Syrian Transit (ترانزيت)** module. It covers the geospatial database schema, geographical queries, client-side mapping layers, state management, and the lifecycle workflows of route creations and moderations.

---

## 1. Geospatial Database Schema & Models

The Transit backend uses MySQL/MariaDB with **Spatial (PostGIS-compatible) extensions** to store and query coordinates, geometries, and polygons.

```mermaid
erDiagram
    CITIES {
        string id PK
        string name_ar
        string name_en
        point center
        polygon bounds
        int zoom
        string status
    }
    ROUTES {
        string id PK
        string city_id FK
        string name_ar
        string name_en
        int color_index
        int price_old
        int price_new
        string status
    }
    ROUTE_GEOMETRIES {
        int id PK
        string route_id FK
        geometry geometry "LINESTRING or MULTILINESTRING"
    }
    STOPS {
        string id PK
        string city_id FK
        string name_ar
        point geometry
    }
    ROUTE_STOP {
        string route_id FK
        string stop_id FK
        int order
    }
    ROUTE_DRAFTS {
        int id PK
        int user_id FK
        string city_id FK
        string name_ar
        string name_en
        int price
        text notes
        json geojson
        string status "pending | approved | rejected"
        text rejection_reason
    }

    CITIES ||--o{ ROUTES : "contains"
    CITIES ||--o{ STOPS : "contains"
    CITIES ||--o{ ROUTE_DRAFTS : "collects"
    ROUTES ||--|| ROUTE_GEOMETRIES : "has path"
    ROUTES ||--o{ ROUTE_STOP : "maps"
    STOPS ||--o{ ROUTE_STOP : "maps"
```

### Database Tables Breakdown
1.  **`cities`**: Defines active operational boundaries.
    *   `center` (`POINT`): Map initial focal coordinates.
    *   `bounds` (`POLYGON`): Geofence limits.
2.  **`routes`**: Represents transit line metadata (Service paths).
3.  **`route_geometries`**: Segregated table storing geographic tracks.
    *   `geometry` (`GEOMETRY`): Stores coordinates for `LineString` or `MultiLineString` paths.
4.  **`stops`**: Points of passenger boarding.
    *   `geometry` (`POINT`): Geographic coordinate.
5.  **`route_stop`**: Pivot table mapping routes to stops.
    *   `order` (`INTEGER`): Visual traversal sequence of stops on the route.
6.  **`route_drafts`**: Stores community submissions from the **Transit Studio**.
    *   `geojson` (`JSON`): Complete client-designed map collection combining paths and points.

---

## 2. SQL & Spatial Operations

The backend performs advanced PostGIS spatial queries to handle search, geo-decoding, and distance lookups:

### A. Distance Calculation (Nearby Stops)
Finds all bus stops within $R$ meters (default: 500m) of the user's location coordinates.
*   **API**: `GET /v1/stops/nearby?lat=33.513&lng=36.291`
*   **SQL Logic** (`TransitController@getNearbyStops`):
    ```sql
    SELECT id, name_ar, city_id, ST_AsGeoJSON(geometry) as geojson 
    FROM stops 
    WHERE ST_Distance_Sphere(geometry, ST_GeomFromText('POINT(lng lat)')) <= radius
    ```

### B. GeoJSON Rendering (Map Data Load)
Instead of retrieving raw columns, Laravel converts database geometric fields into GeoJSON-compliant strings at query time.
*   **API**: `GET /v1/cities/{id}/map-data`
*   **SQL Logic** (`TransitController@getMapData`):
    ```sql
    -- Load route paths
    SELECT routes.*, ST_AsGeoJSON(route_geometries.geometry) as geojson
    FROM route_geometries
    INNER JOIN routes ON route_geometries.route_id = routes.id
    WHERE routes.city_id = ? AND routes.status = 'published';

    -- Load stop locations
    SELECT id, name_ar, ST_AsGeoJSON(geometry) as geojson
    FROM stops
    WHERE city_id = ?;
    ```

---

## 3. Client-Side Mapping & Layering (MapLibre GL)

The map canvas loads vector tiles using MapLibre GL and layers them in order of rendering priority.

```
+-------------------------------------------------------+
|  Top: NearbyTransitDrawer / GlobalSearchBox (UI overlays) |
+-------------------------------------------------------+
|  Layer 5: UserLocationLayer (Active GPS position)      |
+-------------------------------------------------------+
|  Layer 4: StopsLayer (Interactive red/blue stop dots) |
+-------------------------------------------------------+
|  Layer 3: RouteLayer (Active / Highlighted Route path) |
+-------------------------------------------------------+
|  Layer 2: Background reference lines (Opacity 0.22)   |
+-------------------------------------------------------+
|  Layer 1: MapLibre Base Vector (dark-matter style)    |
+-------------------------------------------------------+
```

### Style Scheme (`dark-matter.json`)
The application relies on a locally hosted dark-themed style sheet to ensure privacy and allow potential offline operations.

### Hover and Selection Store (`useMapStore.ts`)
Tracks the user's interactions with map entities:
*   `selectedRouteId` (string | null): The currently selected service line. Triggers focus fitting on that specific line.
*   `hoveredStopId` (string | null): Active stop marker highlighted.
*   `mapBounds` (`[[number, number], [number, number]]`): Dynamic map bounding coordinates.

---

## 4. Workflows

### A. Community Contribution Lifecycle (Transit Studio)

```mermaid
sequenceDiagram
    autonumber
    actor Contributor as Contributor Browser
    participant Store as Zustand (useStudioStore)
    participant Map as MapLibre Canvas
    participant BE as Laravel API
    actor Admin as Admin Portal

    Contributor->>Store: 1. Select City (Step 1)
    Store->>Map: Update bounding box focus
    Contributor->>Map: 2. Draw route path (Step 2 - LineString)
    Map->>Store: Save path coordinates
    Contributor->>Map: 3. Plot stops (Step 3 - Points)
    Map->>Contributor: Open inline name dialog
    Contributor->>Store: Save Stop names & coordinates
    Contributor->>Store: 4. Fill details (Step 4 - Name, Price, Notes)
    Contributor->>Store: 5. Submit contribution (Step 5)
    Store->>BE: POST /v1/studio/routes (Send combined GeoJSON)
    BE->>BE: Create RouteDraft record (status: pending)
    BE-->>Contributor: Response OK with Draft ID
    BE->>Admin: Sync new draft in list
```

#### Detailed Studio States (`useStudioStore.ts`)
*   `WizardStep`: 1 (City Select) $\rightarrow$ 2 (Draw Line) $\rightarrow$ 3 (Add Stops) $\rightarrow$ 4 (Details) $\rightarrow$ 5 (Review).
*   `drawnLine`: `[longitude, latitude]` arrays.
*   `stops`: Objects consisting of `id: Date.now()`, coordinate array, and localized `nameAr`.

---

### B. Admin Moderation Lifecycle (Transit Admin)

The Admin section verifies community drafts and converts them into published database routes in a single database transaction.

```mermaid
stateDiagram-v2
    [*] --> Pending : Contribution Submitted
    
    state Pending {
        [*] --> ListShow : Load in Sidebar
        ListShow --> MapPreview : Admin selects Draft
        MapPreview --> RefLinesOverlay : Load existing routes (yellow)
        RefLinesOverlay --> DraftPathOverlay : Draw draft (orange)
    }

    Pending --> Approved : "Admin clicks 'Approve'"
    Pending --> Rejected : "Admin clicks 'Reject'"

    state Approved {
        [*] --> DbTxBegin : DB Transaction Start
        DbTxBegin --> GenerateRouteId : Generate Slug ID
        GenerateRouteId --> CreateRoute : Insert into routes
        CreateRoute --> InsertGeometry : ST_GeomFromGeoJSON(LineString)
        InsertGeometry --> InsertStops : ST_GeomFromGeoJSON(Points)
        InsertStops --> InsertPivot : Write route_stop order sequence
        InsertPivot --> UpdateDraftStatus : Set draft as 'approved'
        UpdateDraftStatus --> DbTxCommit : Transaction Commit
        DbTxCommit --> CacheBuster : Flush 'transit:cities' & 'map-data:{id}'
    }

    state Rejected {
        [*] --> UpdateDraftStatusRejected : Set draft as 'rejected'
        UpdateDraftStatusRejected --> SaveReason : Write rejection_reason
    }

    Approved --> [*] : Route is Live
    Rejected --> [*] : Draft is Closed
```

#### Database Cache Busting
Upon approval or rejection, the backend explicitly busts associated cache keys to ensure instant map updates for the next user:
```php
Cache::forget("transit:map-data:{$draft->city_id}");
Cache::forget('transit:cities');
```
This forces the subsequent client calls to read the freshly populated geometries directly from the PostGIS database.
