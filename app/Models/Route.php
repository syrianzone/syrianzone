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
    ];

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
