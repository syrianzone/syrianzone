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
        'comments_count' => 'integer',
        'lat' => 'float',
        'likes_count' => 'integer',
        'lng' => 'float',
        'saves_count' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function photos()
    {
        return $this->hasMany(PlacePhoto::class)->orderBy('sort');
    }

    public function likes()
    {
        return $this->hasMany(PlaceLike::class);
    }

    public function saves()
    {
        return $this->hasMany(PlaceSave::class);
    }

    public function comments()
    {
        return $this->hasMany(PlaceComment::class);
    }

    public function reports()
    {
        return $this->hasMany(PlaceReport::class);
    }
}
