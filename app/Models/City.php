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
     * Cities drawn on one shared map, each entry a pair of the group's city ids
     * and the Arabic name that map goes by. Damascus and its countryside are a
     * single network, so the page of either shows the routes of both — and the
     * client renders the pair's banner and route sections from this entry, not
     * from its own copy of the two ids.
     *
     * @var list<array{0: list<string>, 1: string}>
     */
    private const SHARED_MAPS = [
        [['damascus', 'rif-dimashq'], 'دمشق الكبرى'],
    ];

    /**
     * The cities whose routes the map of the given city shows, itself included.
     *
     * @return list<string>
     */
    public static function mapGroup(string $id): array
    {
        return self::sharedGroup($id)[0] ?? [$id];
    }

    /** The map group's own name, or null when the city is a map of one. */
    public static function mapGroupLabel(string $id): ?string
    {
        return self::sharedGroup($id)[1] ?? null;
    }

    /**
     * @return array{0: list<string>, 1: string}|null
     */
    private static function sharedGroup(string $id): ?array
    {
        foreach (self::SHARED_MAPS as [$group, $label]) {
            if (in_array($id, $group, true)) {
                return [$group, $label];
            }
        }

        return null;
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
