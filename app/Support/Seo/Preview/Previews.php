<?php

namespace App\Support\Seo\Preview;

use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Preview\Resolvers\CompassSharePreview;
use App\Support\Seo\Preview\Resolvers\CrossingPreview;
use App\Support\Seo\Preview\Resolvers\GuessWhoRoomPreview;
use App\Support\Seo\Preview\Resolvers\PlacePreview;
use App\Support\Seo\Preview\Resolvers\PollPreview;
use App\Support\Seo\Preview\Resolvers\PrioritiesSharePreview;
use App\Support\Seo\Preview\Resolvers\PromisePreview;
use App\Support\Seo\Preview\Resolvers\TransitCityPreview;
use App\Support\Seo\Preview\Resolvers\TransitRoutePreview;
use Illuminate\Http\Request;

/** The registry of preview resolvers for database-backed pages. */
final class Previews
{
    /**
     * Every resolver, tried in order; the first one that recognises a request
     * wins. Register a new record type here.
     *
     * @var list<class-string<PreviewResolver>>
     */
    public const RESOLVERS = [
        PromisePreview::class,
        PlacePreview::class,
        PollPreview::class,
        TransitRoutePreview::class, // before the city: same path, with ?route=
        TransitCityPreview::class,
        CrossingPreview::class,
        GuessWhoRoomPreview::class,
        CompassSharePreview::class,
        PrioritiesSharePreview::class,
    ];

    /**
     * The preview for a request, or null when no resolver claims it. A lookup
     * that throws (a missing table, a bad identifier) must never break the page
     * it decorates, so it counts as "no preview".
     */
    public static function resolve(Request $request, string $path): ?Preview
    {
        foreach (self::RESOLVERS as $resolver) {
            try {
                $preview = app($resolver)->resolve($request, $path);
            } catch (\Throwable $e) {
                report($e);

                continue;
            }

            if ($preview !== null) {
                return $preview;
            }
        }

        return null;
    }

    /** The resolver that draws cards of the given type, if any. */
    public static function cardSource(string $type): ?CardSource
    {
        foreach (self::RESOLVERS as $resolver) {
            if (is_subclass_of($resolver, CardSource::class) && $resolver::cardType() === $type) {
                return app($resolver);
            }
        }

        return null;
    }
}
