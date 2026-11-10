<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Models\Place;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\Arabic;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/**
 * /mishwar?place={id}: one approved place, the link its share button sends.
 * The card is the place's own photograph with its name over it.
 */
final class PlacePreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    /**
     * Label and glyph per category. The labels are the ones the map uses
     * (Pages/Places/_lib/categories.ts); a test keeps them equal.
     */
    public const CATEGORIES = [
        'historical' => ['تاريخي', 'Landmark'],
        'natural' => ['طبيعي', 'TreePine'],
        'cultural' => ['ثقافي', 'Building2'],
        'religious' => ['ديني', 'Landmark'],
        'abandoned' => ['مهجور', 'Building2'],
        'viewpoint' => ['إطلالة', 'Mountain'],
        'market' => ['سوق', 'Store'],
        'food' => ['مأكولات', 'Utensils'],
        'other' => ['آخر', 'MapPin'],
    ];

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
        $id = $request->query('place');
        if ($path !== '/mishwar' || ! is_string($id) || ! ctype_digit($id)) {
            return null;
        }

        $place = $this->find((int) $id);
        if ($place === null) {
            return null;
        }

        [$category] = self::CATEGORIES[$place->category] ?? self::CATEGORIES['other'];

        return new Preview(
            title: $place->name.' | مشوار',
            shareTitle: $place->name,
            description: Arabic::excerpt($place->description) ?: 'مكان '.$category.' على خريطة مشوار: الصور والموقع والتفاصيل.',
            // The map is one page; a place is a view of it, not a page to index.
            canonicalPath: '/mishwar',
            image: $this->describe($place)->url(),
            parent: null,
            sharePath: '/mishwar?place='.$place->id,
        );
    }

    public function card(string $key): ?RecordCard
    {
        $place = ctype_digit($key) ? $this->find((int) $key) : null;

        return $place === null ? null : $this->describe($place);
    }

    /** Only approved places are public; a pending or rejected one stays unseen. */
    private function find(int $id): ?Place
    {
        return Place::where('status', 'approved')->with('photos')->find($id);
    }

    private function describe(Place $place): RecordCard
    {
        [$label, $glyph] = self::CATEGORIES[$place->category] ?? self::CATEGORIES['other'];
        $photo = $place->photos->first()?->display_url;

        $model = [
            'kind' => 'photo',
            'url' => $this->address('/mishwar'),
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
