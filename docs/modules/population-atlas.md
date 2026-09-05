# Population & Climate Atlas

Canonical route: `/atlas` (legacy `/population` 301-redirects to `/atlas`) · Controller: `App\Http\Controllers\Api\PopulationAtlasController` · Page: `Pages/Population`

Interactive choropleth atlas of Syria combining population data and environmental/climate indicators, rendered with MapLibre on an SVG/GeoJSON Syria map (includes full-Golan geometry).

## API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /atlas` | Renders the Inertia page (canonical; `GET /population` 301-redirects here) |
| `GET /population/master` | Master dataset for the map client |
| `GET /population/env-report` | Environmental report data |

## Data model

Three table families (created 2026_01_17):

1. **Observations** — climate/population observations keyed by `data_type` + `source_id`, per city_name with value, source_url, date, note. Sources are cited per datapoint.
2. **Rainfall** — per pcode/year: rainfall + rainfall_avg (long-term average for anomaly comparison). Weather source: Open-Meteo archive API (`SyriaClimateService`), with OpenWeatherMap as fallback elsewhere.
3. **City environmental snapshot** — lat/lon, population_ref, plus denormalized JSON columns: `current_conditions`, `forecast_summary`, `climate_trends`, `air_quality`, `drought_risk`, `historical_summary`.

## Notes

- Aggregation scripts live in `scripts/syria_environmental_data_aggregator.py` and `scripts/optimize_geojson_floats.py` (geojson precision trimming before upload to R2).
- Map UI: zoom locked to 6–11 (`MapClient.tsx`); province table / comparison headers render canonical Arabic governorate names (`city-name-standardizer.ts`, hyphens treated as spaces for matching); legend bands are generated from the same dynamic thresholds used for map colors.
- Community contributions credited in root README (SourceM7 — data collection; Golan boundary improvements).
