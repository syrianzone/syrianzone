<?php

namespace App\Services\Transit;

use App\Models\City;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\TransitRouteLog;
use Illuminate\Database\Eloquent\Collection;

/**
 * The shape transit records are presented in, for the admin UI, the public map
 * and agents.
 *
 * The spatial columns are only readable through MySQL's ST_AsGeoJSON(), which
 * does not exist on the SQLite test database. Nothing here queries them: a
 * caller that already selected the geometry passes the decoded value in, and a
 * caller that cannot (a listing) simply omits it. That keeps every listing
 * testable, and the geometry tool the one place that pays the MySQL dependency
 * explicitly.
 */
class TransitPresenter
{
    /**
     * One city, as `/transit` and `GET /api/v1/cities` serve it.
     *
     * `$city` must carry the two geometry columns the caller selected through
     * `ST_AsGeoJSON()` (`center_geojson`, `bounds_geojson`) and the published
     * route count as `routeCount`. The icon is the API-only extra.
     *
     * @param  array{viewBox: string, path: string}|null  $icon
     * @return array<string, mixed>
     */
    public function city(City $city, ?array $icon = null): array
    {
        $center = json_decode((string) $city->center_geojson, true)['coordinates'] ?? [0, 0];
        $ring = json_decode((string) $city->bounds_geojson, true)['coordinates'][0] ?? null;

        // The stored ring is closed ([min, min, max, max, min]); its first and
        // third corners are the south-west and north-east ones the client fits.
        $southWest = is_array($ring) && is_array($ring[0] ?? null) ? $ring[0] : null;
        $northEast = is_array($ring) && is_array($ring[2] ?? null) ? $ring[2] : null;
        $bounds = $southWest !== null && $northEast !== null
            ? [[$southWest[0], $southWest[1]], [$northEast[0], $northEast[1]]]
            : null;

        return [
            'id' => $city->id,
            'nameAr' => $city->name_ar,
            'nameEn' => $city->name_en,
            'status' => $city->status,
            'zoom' => $city->zoom,
            'center' => $center,
            'bounds' => $bounds,
            'routeCount' => $city->routeCount ?? 0,
            'mapGroup' => City::mapGroup((string) $city->id),
            'mapGroupLabel' => City::mapGroupLabel((string) $city->id),
        ] + ($icon === null ? [] : ['icon' => $icon]);
    }

    /**
     * A published route as a map Feature.
     *
     * The one server-side route feature: the public map and the admin geometry
     * endpoint call this, and the studio's own GeoJSON is the only copy in the
     * browser. `colorIndex` (the spelling the browser and the Flutter client
     * read) is the only key the colour travels under.
     *
     * `$route` is a `Route` model or the row a DB query selected those columns
     * into.
     *
     * @param  object{id: string, name_ar: string, name_en: string|null, color_index: int|null, price_old: int|null, price_new: int|null}  $route
     * @param  array<string, mixed>  $geometry
     * @return array<string, mixed>
     */
    public function routeFeature(object $route, array $geometry): array
    {
        return [
            'type' => 'Feature',
            'geometry' => $geometry,
            'properties' => [
                'id' => $route->id,
                'nameAr' => $route->name_ar,
                'nameEn' => $route->name_en,
                'colorIndex' => (int) ($route->color_index ?? 0),
                'priceOld' => $route->price_old,
                'priceNew' => $route->price_new,
            ],
        ];
    }

    /**
     * A stop as a map Feature. `$routeIds` is present only where the caller
     * sends it: the public map tags each stop with the routes that serve it, the
     * admin geometry endpoint does not.
     *
     * @param  array<string, mixed>  $geometry
     * @param  array<int, string>|null  $routeIds
     * @return array<string, mixed>
     */
    public function stopFeature(mixed $stop, array $geometry, ?array $routeIds = null): array
    {
        return [
            'type' => 'Feature',
            'geometry' => $geometry,
            'properties' => [
                'id' => $stop->id,
                'nameAr' => $stop->name_ar,
            ] + ($routeIds === null ? [] : ['routeIds' => $routeIds]),
        ];
    }

    /**
     * @param  Collection<int, RouteDraft>  $drafts
     * @return array<int, array<string, mixed>>
     */
    public function drafts(Collection $drafts): array
    {
        return $drafts->map(fn (RouteDraft $d) => $this->draft($d))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function draft(RouteDraft $d): array
    {
        return [
            'id' => $d->id,
            'city_id' => $d->city_id,
            'city_name_ar' => $this->loaded($d, 'city', 'name_ar'),
            'city_name_en' => $this->loaded($d, 'city', 'name_en'),
            'name_ar' => $d->name_ar,
            'name_en' => $d->name_en,
            'price' => $d->price,
            'color_index' => $d->color_index,
            'status' => $d->status,
            'rejection_reason' => $d->rejection_reason,
            'route_id' => $d->route_id,
            'linked_route_name_ar' => $this->loaded($d, 'linkedRoute', 'name_ar'),
            'contributor' => $this->loaded($d, 'user', 'name'),
            // Feature counts only: the coordinates themselves need MySQL.
            'feature_count' => is_array($d->geojson) ? count($d->geojson['features'] ?? []) : 0,
            'created_at' => $d->created_at?->toIso8601String(),
        ];
    }

    /**
     * @param  Collection<int, Route>  $routes
     * @return array<int, array<string, mixed>>
     */
    public function routes(Collection $routes): array
    {
        return $routes->map(fn (Route $r) => $this->route($r))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function route(Route $r): array
    {
        return [
            'id' => $r->id,
            'city_id' => $r->city_id,
            'city_name_ar' => $this->loaded($r, 'city', 'name_ar'),
            'city_name_en' => $this->loaded($r, 'city', 'name_en'),
            'name_ar' => $r->name_ar,
            'name_en' => $r->name_en,
            'status' => $r->status,
            'color_index' => $r->color_index,
            'price_old' => $r->price_old,
            'price_new' => $r->price_new,
            'stops_count' => $r->stops_count ?? null,
            'user_id' => $r->user_id,
            'created_at' => $r->created_at?->toIso8601String(),
        ];
    }

    /**
     * @param  Collection<int, TransitRouteLog>  $logs
     * @return array<int, array<string, mixed>>
     */
    public function logs(Collection $logs): array
    {
        return $logs->map(fn (TransitRouteLog $l) => $this->log($l))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function log(TransitRouteLog $l): array
    {
        return [
            'id' => $l->id,
            'route_id' => $l->route_id,
            'action' => $l->action,
            'description' => $l->description,
            'actor' => $this->loaded($l, 'user', 'name'),
            'created_at' => $l->created_at?->toIso8601String(),
        ];
    }

    /**
     * Read an attribute only when the relation is already loaded, so presenting
     * a collection can never trigger a lazy load per row.
     */
    protected function loaded(mixed $model, string $relation, string $attribute): mixed
    {
        if (! $model->relationLoaded($relation)) {
            return null;
        }

        return $model->getRelation($relation)?->{$attribute};
    }
}
