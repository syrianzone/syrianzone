<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Place extends Model
{
    use HasFactory;

    public const CATEGORIES = [
        'historical',
        'natural',
        'cultural',
        'religious',
        'abandoned',
        'viewpoint',
        'market',
        'other',
    ];

    protected $fillable = [
        'user_id',
        'name',
        'category',
        'description',
        'lat',
        'lng',
        'status',
        'rejection_reason',
        'approved_at',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'lat' => 'float',
        'lng' => 'float',
        'saves_count' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function photos()
    {
        return $this->hasMany(PlacePhoto::class)->orderBy('sort');
    }

    public function saves()
    {
        return $this->hasMany(PlaceSave::class);
    }
}
