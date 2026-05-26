<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RouteDraft extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'city_id',
        'name_ar',
        'name_en',
        'price',
        'notes',
        'geojson',
        'status'
    ];

    protected $casts = [
        'geojson' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }
}
