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

    /**
     * Cities drawn on one shared map. Damascus and its countryside are a single
     * network, so the page of either shows the routes of both.
     */
    private const SHARED_MAPS = [
        ['damascus', 'rif-dimashq'],
    ];

    /**
     * The cities whose routes the map of the given city shows, itself included.
     *
     * @return list<string>
     */
    public static function mapGroup(string $id): array
    {
        foreach (self::SHARED_MAPS as $group) {
            if (in_array($id, $group, true)) {
                return $group;
            }
        }

        return [$id];
    }

    public function routes()
    {
        return $this->hasMany(Route::class);
    }

    public function stops()
    {
        return $this->hasMany(Stop::class);
    }
}
