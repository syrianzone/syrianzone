<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Models\Route;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/**
 * /transit/city/{id}?route={routeId}: one published route selected on a city
 * map. Listed before TransitCityPreview, which owns the same path without the
 * parameter.
 */
final class TransitRoutePreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    /** The route colours of the map (Pages/Transit/_lib/mapColors.ts); a test keeps them equal. */
    public const PALETTE = ['#e8a838', '#c44b4b', '#4a8fa8', '#7ab87a', '#d4956a', '#9b6bb5', '#5ba08a', '#c9784a'];

    public static function cardType(): string
    {
        return 'route';
    }

    public static function fallbackCard(): string
    {
        return 'transit';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        $routeId = $request->query('route');
        if (! preg_match('#^/transit/city/([a-z0-9\-]+)$#', $path, $m) || ! is_string($routeId)) {
            return null;
        }

        $route = $this->find($routeId);
        if ($route === null || $route->city_id !== $m[1]) {
            return null;
        }

        $city = $route->city->name_ar;

        return new Preview(
            title: $route->name_ar.' | مواصلات '.$city,
            shareTitle: $route->name_ar,
            description: 'مسار ومواقف '.$route->name_ar.' في '.$city.' على خريطة ترانزيت سوريا.',
            canonicalPath: $path,
            image: $this->describe($route)->url(),
            parent: TransitCityPreview::PARENT,
            sharePath: $path.'?route='.$route->id,
        );
    }

    public function card(string $key): ?RecordCard
    {
        $route = $this->find($key);

        return $route === null ? null : $this->describe($route);
    }

    private function find(string $id): ?Route
    {
        if (! preg_match('#^[A-Za-z0-9_\-]+$#', $id)) {
            return null;
        }

        return Route::where('status', 'published')->with('city')->find($id);
    }

    private function describe(Route $route): RecordCard
    {
        return new RecordCard(self::cardType(), (string) $route->id, [
            'kind' => 'split',
            'url' => $this->address('/transit/city/'.$route->city_id),
            'kicker' => ['icon' => 'transit', 'label' => 'ترانزيت'],
            'pills' => [
                ['label' => $route->city->name_ar, 'glyph' => 'MapPin'],
                ['label' => 'خط نقل عام', 'glyph' => 'Bus'],
            ],
            'title' => $route->name_ar,
            // A line in the colour this route has on the map.
            'art' => ['type' => 'route', 'colour' => self::PALETTE[abs((int) $route->color_index) % count(self::PALETTE)]],
        ]);
    }
}
