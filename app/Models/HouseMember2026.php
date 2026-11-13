<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class HouseMember2026 extends Model
{
    /**
     * The public roster payload. The model owns the rows, so it owns the key
     * and the one way to drop it.
     */
    public const CACHE_KEY = 'house:members_2026_v1';

    protected $table = 'house_members_2026';

    protected $fillable = [
        'name_ar', 'governorate_ar', 'district', 'town', 'gender',
        'birth_year', 'age', 'selection_method', 'category',
        'status', 'member_number', 'management_position',
        'facebook_url', 'twitter_url',
    ];

    public static function forgetRosterCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
