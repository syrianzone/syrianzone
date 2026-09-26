<?php

namespace App\Services\Transit;

use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\TransitRouteLog;
use Illuminate\Database\Eloquent\Collection;

/**
 * The shape transit records are presented in, for the admin UI and for agents.
 *
 * Deliberately excludes geometry. The spatial columns are only readable through
 * MySQL's ST_AsGeoJSON(), which does not exist on the SQLite test database, so a
 * presenter that reached for it would make every listing untestable. Agents that
 * genuinely need coordinates get them from the dedicated geometry tool, which is
 * the one place that pays the MySQL dependency explicitly.
 */
class TransitPresenter
{
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
