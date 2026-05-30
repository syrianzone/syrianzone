<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RouteGeometry extends Model
{
    protected $fillable = [
        'route_id',
        'geometry',
    ];

    public function route()
    {
        return $this->belongsTo(Route::class);
    }
}
