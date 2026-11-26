<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Models\Place;
use App\Services\Places\PlaceGovernorates;
use App\Services\Places\PlaceIndexability;
use App\Services\Places\PlaceUrls;
use App\Support\Facts;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\Arabic;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * `/mishwar/{id}-{slug}` (and legacy `/mishwar?place={id}` map deep link):
 * one approved place, with its photo share card, Place/TouristAttraction
 * JSON-LD, 3-level breadcrumb, and thin-page noindex guard.
 */
final class PlacePreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    public function __construct(private readonly PlaceGovernorates $governorates) {}

    /**
     * Label and glyph per category, from the shared place vocabulary
     * (resources/data/places.json) that the map's filter chips read too.
     *
     * @return array<string, array{0: string, 1: string}>
     */
    public static function categories(): array
    {
        return Facts::placeCategoryCards();
    }

    public static function cardType(): string
    {
        return 'place';
    }

    public static function fallbackCard(): string
    {
        return 'mishwar';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        $id = $this->extractPlaceId($request, $path);
        if ($id === null) {
            return null;
        }

        $remembered = SeoMeta::remembered($request, 'place');
        $place = ($remembered instanceof Place && (int) $remembered->id === $id && $remembered->status === 'approved')
            ? $remembered
            : $this->find($id);

        if ($place === null) {
            return null;
        }

        if (! $place->relationLoaded('photos')) {
            $place->load('photos');
        }

        return $this->buildPreview($place);
    }

    public function card(string $key): ?RecordCard
    {
        $place = ctype_digit($key) ? $this->find((int) $key) : null;

        return $place === null ? null : $this->describe($place);
    }

    private function extractPlaceId(Request $request, string $path): ?int
    {
        if ($path === '/mishwar') {
            $raw = $request->query('place');

            return is_string($raw) && ctype_digit($raw) ? (int) $raw : null;
        }

        if (str_starts_with($path, '/mishwar/')) {
            $segment = substr($path, strlen('/mishwar/'));
            if ($segment === '' || str_contains($segment, '/')) {
                return null;
            }

            $parsed = PlaceUrls::parse($segment);

            return $parsed !== null ? $parsed[0] : null;
        }

        return null;
    }

    private function buildPreview(Place $place): Preview
    {
        [$category] = self::categories()[$place->category] ?? self::categories()['other'];

        $govId = $this->governorates->forPlace($place);
        $gov = $govId !== null ? Facts::governorate($govId) : null;
        $govNameAr = $gov !== null ? (string) $gov['name_ar'] : null;

        $title = $govNameAr !== null
            ? "{$place->name} في {$govNameAr} — صور وموقع | مشوار"
            : "{$place->name} — صور وموقع | مشوار";

        $fallbackDescription = $govNameAr !== null
            ? "مكان {$category} في {$govNameAr} على خريطة مشوار: الصور والموقع والتفاصيل."
            : "مكان {$category} على خريطة مشوار: الصور والموقع والتفاصيل.";

        $description = Arabic::excerpt($place->description) ?: $fallbackDescription;
        $canonicalPath = $place->publicPath();

        $parents = [['/mishwar', 'مشوار']];
        if ($govId !== null && $govNameAr !== null) {
            $parents[] = ['/mishwar/'.$govId, $govNameAr];
        }

        $timestamps = array_filter([
            $place->updated_at,
            $place->photos->max('updated_at'),
        ]);
        $modified = $timestamps !== []
            ? max(array_map(static fn ($ts) => Carbon::parse($ts), $timestamps))
            : null;

        return new Preview(
            title: $title,
            shareTitle: $place->name,
            description: $description,
            canonicalPath: $canonicalPath,
            image: $this->describe($place)->url(),
            type: 'article',
            noindex: PlaceIndexability::isThin($place),
            schema: 'WebPage',
            sharePath: null,
            published: $place->approved_at ?? $place->created_at,
            modified: $modified,
            mainEntity: $this->placeEntity($place, $canonicalPath, $description, $govNameAr),
            parents: $parents,
        );
    }

    /**
     * Schema.org `@type` mapped by Mishwar category.
     *
     * @return string|list<string>
     */
    public static function schemaTypeForCategory(string $category): string|array
    {
        return match ($category) {
            'historical' => ['TouristAttraction', 'LandmarksOrHistoricalBuildings'],
            'religious' => ['TouristAttraction', 'PlaceOfWorship'],
            'food' => 'FoodEstablishment',
            'natural', 'viewpoint', 'cultural', 'market', 'abandoned' => 'TouristAttraction',
            default => 'Place',
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function placeEntity(Place $place, string $canonicalPath, string $description, ?string $govNameAr): array
    {
        $base = rtrim((string) config('seo.base_url'), '/');

        $images = [];
        foreach ($place->photos->take(5) as $photo) {
            $url = trim((string) $photo->display_url);
            if ($url === '') {
                continue;
            }
            if (! str_starts_with($url, 'http://') && ! str_starts_with($url, 'https://')) {
                $url = $base.'/'.ltrim($url, '/');
            }
            $images[] = $url;
        }

        $address = array_filter([
            '@type' => 'PostalAddress',
            'addressRegion' => $govNameAr,
            'addressCountry' => 'SY',
        ], static fn (mixed $v): bool => $v !== null && $v !== '');

        return array_filter([
            '@type' => self::schemaTypeForCategory((string) $place->category),
            'name' => $place->name,
            'description' => $description,
            'url' => $base.$canonicalPath,
            'image' => $images !== [] ? $images : null,
            'geo' => [
                '@type' => 'GeoCoordinates',
                'latitude' => (float) $place->lat,
                'longitude' => (float) $place->lng,
            ],
            'address' => $address,
            'hasMap' => 'https://www.google.com/maps/search/?api=1&query='.$place->lat.','.$place->lng,
        ], static fn (mixed $v): bool => $v !== null && $v !== '' && $v !== []);
    }

    /** Only approved places are public; a pending or rejected one stays unseen. */
    private function find(int $id): ?Place
    {
        return Place::where('status', 'approved')->with('photos')->find($id);
    }

    private function describe(Place $place): RecordCard
    {
        [$label, $glyph] = self::categories()[$place->category] ?? self::categories()['other'];
        $photo = $place->photos->first()?->display_url;

        $model = [
            'kind' => 'photo',
            'url' => $this->address('/mishwar/'.$place->id),
            'kicker' => ['icon' => 'mishwar', 'label' => 'مشوار'],
            'pills' => [['label' => $label, 'glyph' => $glyph]],
            'title' => $place->name,
            // Drawn in place of the photograph when there is none to show.
            'art' => ['type' => 'icon', 'icon' => 'mishwar'],
        ];
        if ($photo) {
            $model['photo'] = $photo;
        }

        return new RecordCard(self::cardType(), (string) $place->id, $model, $photo ? 'jpg' : 'png');
    }
}
