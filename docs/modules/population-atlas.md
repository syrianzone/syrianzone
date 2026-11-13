# Population & Climate Atlas

Canonical route: `/atlas` (legacy `/population` 301-redirects to `/atlas`) · Controller: `App\Http\Controllers\Api\PopulationAtlasController` · Page: `Pages/Population`

Interactive choropleth atlas of Syria combining population data and environmental/climate indicators, rendered with Leaflet/react-leaflet on a GeoJSON Syria map (includes full-Golan geometry).

## API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /atlas` | Renders the Inertia page (canonical; `GET /population` 301-redirects here) |
| `GET /api/v1/atlas` | Master dataset for the map client (legacy `GET /api/population/master`) |
| `GET /api/v1/atlas/environment` | Environmental report data (legacy `GET /api/population/env-report`) |

## Data model

Three table families (created 2026_01_17):

1. **Observations** — climate/population observations keyed by `data_type` + `source_id`, per city_name with value, source_url, date, note. Sources are cited per datapoint.
2. **Rainfall** — per pcode/year: rainfall + rainfall_avg (long-term average for anomaly comparison). Weather source: Open-Meteo archive API (`SyriaClimateService`), with OpenWeatherMap as fallback elsewhere.
3. **City environmental snapshot** — lat/lon, population_ref, plus denormalized JSON columns: `current_conditions`, `forecast_summary`, `climate_trends`, `air_quality`, `drought_risk`, `historical_summary`.

## Seeding

```bash
php artisan db:seed --class=PopulationAtlasSeeder
```

The seeder reads two files from `storage/app/seed_data/` and then creates the 14 governorate environmental logs inline. Rerunning does not duplicate rows, but it clears existing weather reports and resets `last_updated_at` to yesterday. Run `php artisan population:update-climate` afterward to refresh those reports.

| File | Tracked | If missing |
|---|---|---|
| `population.csv` | Yes (excepted in `storage/app/.gitignore`) | The seeder fails with an error and a non-zero exit code, as it does for a file with a header but no data rows. Restore it with `git checkout -- storage/app/seed_data/population.csv`. |
| `rainfall_yearly.json` | Yes (excepted in `storage/app/.gitignore`) | The seeder warns and the rainfall layer stays empty. |

`population.csv` columns: `data_type, source_id, source_url, date, note, city_name, population`. `date` is a year (`2020`, stored as `2020-01-01`), a full date, or `unknown` (stored as null).

`rainfall_yearly.json` is an object keyed by district code (`pcode`), each value a list of `{"year": 2020, "rainfall": 123.4, "rainfall_avg": 110.2}` entries (the committed snapshot covers 2021-2025 across 75 district codes). A file that is present but is not a non-empty JSON object (for example `[]` or `{}`) makes the seeder fail.

The hourly `population:update-climate` job only refreshes existing environmental logs, so it cannot bootstrap an empty database. Run the seeder first.

## Notes

- Aggregation scripts live in `scripts/syria_environmental_data_aggregator.py` and `scripts/optimize_geojson_floats.py` (geojson precision trimming before upload to R2).
- Map UI: zoom locked to 6–11 (`MapClient.tsx`); province table / comparison headers render canonical Arabic governorate names (`Domain/geography/governorates.ts`, which reads `resources/data/governorates.json`; hyphens are treated as spaces for matching); the legend is generated from the same band table the fill colours use (`constants/data-config.ts` + `utils/color-calculator.ts`): the page's data-driven thresholds replace both at once, so no legend entry can describe a boundary the map does not draw.
- Community contributions credited in root README (SourceM7 — data collection; Golan boundary improvements).
