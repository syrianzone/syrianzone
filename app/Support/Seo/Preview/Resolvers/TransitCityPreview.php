<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Models\City;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\Arabic;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/** /transit/city/{id}: the public transport map of one city. */
final class TransitCityPreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    public const PARENT = ['/transit', 'ترانزيت سوريا'];

    public static function cardType(): string
    {
        return 'city';
    }

    public static function fallbackCard(): string
    {
        return 'transit';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        if (! preg_match('#^/transit/city/([a-z0-9\-]+)$#', $path, $m)) {
            return null;
        }

        $city = City::find($m[1]);
        if ($city === null) {
            return null;
        }

        return new Preview(
            title: 'مواصلات '.$city->name_ar.' | ترانزيت',
            shareTitle: 'مواصلات '.$city->name_ar,
            description: 'خريطة خطوط المواصلات العامة والسرافيس والمواقف في '.$city->name_ar.' على ترانزيت سوريا.',
            canonicalPath: $path,
            image: $this->describe($city)->url(),
            parent: self::PARENT,
        );
    }

    public function card(string $key): ?RecordCard
    {
        $city = preg_match('#^[a-z0-9\-]+$#', $key) ? City::find($key) : null;

        return $city === null ? null : $this->describe($city);
    }

    private function describe(City $city): RecordCard
    {
        $routes = $city->routes()->where('status', 'published')->count();

        return new RecordCard(self::cardType(), (string) $city->id, [
            'kind' => 'split',
            'url' => $this->address('/transit/city/'.$city->id),
            'kicker' => ['icon' => 'transit', 'label' => 'ترانزيت'],
            'title' => 'مواصلات '.$city->name_ar,
            'subtitle' => 'خريطة خطوط السرافيس والباصات والمواقف',
            // The live number of published routes; a city with none shows the icon.
            'art' => $routes > 0
                ? ['type' => 'figure', 'value' => $routes, 'label' => Arabic::counted($routes, ['one' => 'خط', 'two' => 'خطّان', 'few' => 'خطوط', 'many' => 'خطاً'])]
                : ['type' => 'icon', 'icon' => 'transit'],
        ]);
    }
}
