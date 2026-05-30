<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class City extends Model
{
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'name_ar',
        'name_en',
        'center',
        'bounds',
        'zoom',
        'status',
    ];

    public function routes()
    {
        return $this->hasMany(Route::class);
    }

    public function stops()
    {
        return $this->hasMany(Stop::class);
    }
}
