<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Laravel\Scout\Searchable;

class Route extends Model
{
    use Searchable;
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'city_id',
        'name_ar',
        'name_en',
        'color_index',
        'price_old',
        'price_new',
        'status',
        'user_id',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function city()
    {
        return $this->belongsTo(City::class);
    }

    public function geometry()
    {
        return $this->hasOne(RouteGeometry::class);
    }

    public function stops()
    {
        return $this->belongsToMany(Stop::class, 'route_stop')->withPivot('order')->orderBy('pivot_order');
    }

    /**
     * Add `stops_count` by counting the pivot rows.
     *
     * withCount('stops') counts through a join to the stops table, which the
     * foreign key on route_stop already guarantees; counting route_stop alone
     * is the same number from an index on route_id, without touching stops.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<Route>  $query
     */
    public function scopeWithStopsCount($query)
    {
        if ($query->getQuery()->columns === null) {
            $query->select($this->getTable().'.*');
        }

        return $query->selectSub(
            \Illuminate\Support\Facades\DB::table('route_stop')
                ->selectRaw('count(*)')
                ->whereColumn('route_stop.route_id', $this->getTable().'.id'),
            'stops_count',
        );
    }

    /**
     * This route's stops in travel order, each with its point as a GeoJSON
     * string, in one query.
     *
     * Geometry cannot come through Eloquent (it is a spatial column and needs
     * ST_AsGeoJSON), so callers used to load the stops and then ask for each
     * point separately: one query per stop.
     *
     * @return \Illuminate\Support\Collection<int, object{id: string, name_ar: string, geojson: ?string}>
     */
    public function stopPoints(): \Illuminate\Support\Collection
    {
        return \Illuminate\Support\Facades\DB::table('route_stop')
            ->join('stops', 'stops.id', '=', 'route_stop.stop_id')
            ->where('route_stop.route_id', $this->id)
            ->orderBy('route_stop.order')
            ->selectRaw('stops.id, stops.name_ar, ST_AsGeoJSON(stops.geometry) as geojson')
            ->get();
    }

    public function toSearchableArray()
    {
        return [
            'id' => $this->id,
            'name_ar' => $this->name_ar,
            'name_en' => $this->name_en,
            'city_id' => $this->city_id,
        ];
    }
}
