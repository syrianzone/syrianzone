<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TransitRouteLog extends Model
{
    protected $fillable = [
        'route_id',
        'action',
        'description',
        'user_id',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function route()
    {
        return $this->belongsTo(Route::class);
    }
}
