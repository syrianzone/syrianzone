<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Support\Facts;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/** /muslim/ramadan/{city}: Ramadan 1448 / 2027 imsakiya for one Syrian governorate. */
final class RamadanCityPreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    public static function cardType(): string
    {
        return 'ramadan';
    }

    public static function fallbackCard(): string
    {
        return 'ramadan';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        if (! preg_match('#^/muslim/ramadan/([a-z0-9-]+)$#', $path, $m)) {
            return null;
        }

        $gov = Facts::governorate($m[1]);
        if ($gov === null) {
            return null;
        }

        $cityName = (string) $gov['name_ar'];

        return new Preview(
            title: 'إمساكية رمضان 2027 في '.$cityName.' | الركن الإسلامي',
            shareTitle: 'إمساكية رمضان 2027 في '.$cityName,
            description: 'إمساكية شهر رمضان المبارك 1448 هـ / 2027 م في '.$cityName.' بتوقيت سوريا: مواعيد الإمساك والفجر والشروق والظهر والعصر والمغرب (الإفطار) والعشاء يومياً.',
            canonicalPath: '/muslim/ramadan/'.$gov['id'],
            image: $this->describe($gov)->url(),
            parent: ['/muslim/ramadan', 'إمساكية رمضان 1448 هـ / 2027 م'],
        );
    }

    public function card(string $key): ?RecordCard
    {
        if ($key === '' || ! preg_match('/^[a-z0-9-]+$/', $key)) {
            return null;
        }

        $gov = Facts::governorate($key);

        return $gov === null ? null : $this->describe($gov);
    }

    /** @param  array<string, mixed>  $gov */
    private function describe(array $gov): RecordCard
    {
        $id = (string) $gov['id'];
        $image = $this->photoFor($id);

        $model = [
            'kind' => 'photo',
            'url' => $this->address('/muslim/ramadan/'.$id),
            'kicker' => ['icon' => 'muslim', 'label' => 'الركن الإسلامي'],
            'pills' => [
                ['label' => 'رمضان 1448 هـ / 2027 م', 'glyph' => 'Calendar'],
                ['label' => (string) $gov['name_ar'], 'glyph' => 'MapPin'],
            ],
            'title' => 'إمساكية رمضان 2027 في '.$gov['name_ar'],
            'art' => ['type' => 'icon', 'icon' => 'muslim'],
        ];

        if ($image !== null) {
            $model['photo'] = $image;
        }

        return new RecordCard(self::cardType(), $id, $model, $image !== null ? 'jpg' : 'png');
    }

    private function photoFor(string $governorateId): ?string
    {
        try {
            $images = Facts::ramadanImages();
        } catch (\Throwable) {
            return null;
        }

        $file = $images[$governorateId]['file'] ?? null;
        if (! is_string($file) || $file === '') {
            return null;
        }

        return is_file(public_path(ltrim($file, '/'))) ? $file : null;
    }
}
