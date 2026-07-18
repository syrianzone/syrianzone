<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

final class TransitDraftGeoJson
{
    public const MAX_FEATURES = 101;

    public const MAX_ROUTE_COORDINATES = 2000;

    public const MAX_STOPS = 100;

    private const MAX_LATITUDE = 38.0;

    private const MAX_LONGITUDE = 43.0;

    private const MIN_LATITUDE = 31.5;

    private const MIN_LONGITUDE = 35.0;

    /**
     * Validate the constrained GeoJSON contract accepted by Transit Studio.
     *
     * @return array<string, mixed>
     */
    public static function validate(mixed $value): array
    {
        if (! is_array($value) || ($value['type'] ?? null) !== 'FeatureCollection') {
            self::fail('The geojson field must be a GeoJSON FeatureCollection.');
        }

        $features = $value['features'] ?? null;
        if (! is_array($features) || ! array_is_list($features) || $features === []) {
            self::fail('The geojson features field must be a non-empty list.');
        }

        if (count($features) > self::MAX_FEATURES) {
            self::fail('The route draft contains too many GeoJSON features.');
        }

        $lineCount = 0;
        $stopCount = 0;

        foreach ($features as $featureIndex => $feature) {
            if (! is_array($feature) || ($feature['type'] ?? null) !== 'Feature') {
                self::fail("Feature {$featureIndex} must be a GeoJSON Feature.");
            }

            $properties = $feature['properties'] ?? [];
            if ($properties !== null && ! is_array($properties)) {
                self::fail("Feature {$featureIndex} properties must be an object or null.");
            }

            $geometry = $feature['geometry'] ?? null;
            if (! is_array($geometry)) {
                self::fail("Feature {$featureIndex} must contain a geometry object.");
            }

            $geometryType = $geometry['type'] ?? null;
            if (! in_array($geometryType, ['LineString', 'Point'], true)) {
                self::fail("Feature {$featureIndex} geometry must be a LineString or Point.");
            }

            if ($geometryType === 'LineString') {
                $lineCount++;
                self::validateLineCoordinates($geometry['coordinates'] ?? null, $featureIndex);

                continue;
            }

            $stopCount++;
            if ($stopCount > self::MAX_STOPS) {
                self::fail('The route draft contains too many stops.');
            }

            self::validatePosition($geometry['coordinates'] ?? null, "Feature {$featureIndex} point");

            $nameAr = is_array($properties) ? ($properties['nameAr'] ?? null) : null;
            if ($nameAr !== null && (! is_string($nameAr) || mb_strlen($nameAr) > 255)) {
                self::fail("Feature {$featureIndex} stop name must be a string of at most 255 characters.");
            }
        }

        if ($lineCount !== 1) {
            self::fail('The route draft must contain exactly one LineString.');
        }

        return $value;
    }

    private static function validateLineCoordinates(mixed $coordinates, int $featureIndex): void
    {
        if (! is_array($coordinates) || ! array_is_list($coordinates) || count($coordinates) < 2) {
            self::fail("Feature {$featureIndex} LineString must contain at least two coordinates.");
        }

        if (count($coordinates) > self::MAX_ROUTE_COORDINATES) {
            self::fail("Feature {$featureIndex} LineString contains too many coordinates.");
        }

        $first = self::validatePosition($coordinates[0], "Feature {$featureIndex} LineString coordinate 0");
        $hasDistinctPosition = false;

        foreach (array_slice($coordinates, 1) as $coordinateIndex => $coordinate) {
            $position = self::validatePosition(
                $coordinate,
                'Feature '.$featureIndex.' LineString coordinate '.($coordinateIndex + 1),
            );

            if (
                (float) $position[0] !== (float) $first[0]
                || (float) $position[1] !== (float) $first[1]
            ) {
                $hasDistinctPosition = true;
            }
        }

        if (! $hasDistinctPosition) {
            self::fail("Feature {$featureIndex} LineString must contain two distinct positions.");
        }
    }

    /**
     * @return array{0: int|float, 1: int|float}
     */
    private static function validatePosition(mixed $coordinate, string $label): array
    {
        if (! is_array($coordinate) || ! array_is_list($coordinate) || count($coordinate) !== 2) {
            self::fail("{$label} must contain longitude and latitude.");
        }

        [$longitude, $latitude] = $coordinate;
        if (
            (! is_int($longitude) && ! is_float($longitude))
            || (! is_int($latitude) && ! is_float($latitude))
            || ! is_finite((float) $longitude)
            || ! is_finite((float) $latitude)
        ) {
            self::fail("{$label} must contain finite numeric coordinates.");
        }

        if (
            $longitude < self::MIN_LONGITUDE
            || $longitude > self::MAX_LONGITUDE
            || $latitude < self::MIN_LATITUDE
            || $latitude > self::MAX_LATITUDE
        ) {
            self::fail("{$label} must fall within Syria's supported coordinate bounds.");
        }

        return [$longitude, $latitude];
    }

    private static function fail(string $message): never
    {
        throw ValidationException::withMessages(['geojson' => $message]);
    }
}
