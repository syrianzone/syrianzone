<?php

namespace App\Services\Transit;

use App\Support\Facts;

/**
 * The transit rules that more than one entry point validates.
 *
 * Route and draft statuses, the `color_index` ceiling and the submitted GeoJSON
 * contract used to be restated in the HTTP controllers and again in the agent
 * tools — which is how two tools ended up accepting a colour index above the
 * ceiling the rest of the module enforces. Places, polls and promises each have
 * one rules object; this is transit's.
 */
final class TransitRules
{
    /** Route publication states, in the order the admin UI lists them. */
    public const STATUSES = ['published', 'disapproved', 'hidden'];

    /** Draft review states. */
    public const DRAFT_STATUSES = ['pending', 'approved', 'rejected'];

    /**
     * The Arabic name of each route state, for the audit log and the admin UI.
     *
     * @var array<string, string>
     */
    public const STATUS_LABELS = [
        'published' => 'منشور',
        'disapproved' => 'ملغى (مرفوض)',
        'hidden' => 'مخفي',
    ];

    public static function colorIndexMax(): int
    {
        return (int) Facts::transit()['color_index_max'];
    }

    /**
     * @return array<int, string>
     */
    public static function colorIndex(): array
    {
        return ['nullable', 'integer', 'min:0', 'max:'.self::colorIndexMax()];
    }

    /** `in:` rule for a route's publication status. */
    public static function statusRule(bool $withAll = false): string
    {
        return 'in:'.implode(',', $withAll ? [...self::STATUSES, 'all'] : self::STATUSES);
    }

    /** `in:` rule for a draft's review status. */
    public static function draftStatusRule(bool $withAll = false): string
    {
        return 'in:'.implode(',', $withAll ? [...self::DRAFT_STATUSES, 'all'] : self::DRAFT_STATUSES);
    }

    /**
     * The GeoJSON contract a contributed or imported route is submitted in: one
     * line plus its stops, each geometry typed and coordinate-bearing.
     *
     * @return array<string, string>
     */
    public static function routeGeoJson(bool $sometimes = false): array
    {
        $required = $sometimes ? 'required_with:geojson|' : 'required|';

        return [
            'geojson' => $sometimes ? 'sometimes|array' : 'required|array',
            'geojson.features' => $required.'array|min:1|max:500',
            'geojson.features.*.geometry' => $required.'array',
            'geojson.features.*.geometry.type' => $required.'string|in:LineString,MultiLineString,Point',
            'geojson.features.*.geometry.coordinates' => $required.'array|min:1',
        ];
    }
}
