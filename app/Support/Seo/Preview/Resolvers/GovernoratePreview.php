<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Services\Governorates\GovernorateDataService;
use App\Support\Facts;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/** /governorates/{id}: overview, governor, prayer, transit, crossings, places and numbers for one Syrian governorate. */
final class GovernoratePreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    public static function cardType(): string
    {
        return 'governorate';
    }

    public static function fallbackCard(): string
    {
        return 'governorates';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        if (! preg_match('#^/governorates/([a-z0-9-]+)$#', $path, $m)) {
            return null;
        }

        $gov = Facts::governorate($m[1]);
        if ($gov === null) {
            return null;
        }

        $id = (string) $gov['id'];
        $nameAr = (string) $gov['name_ar'];
        $nameEn = (string) $gov['name_en'];
        $centreAr = GovernorateDataService::centreAr($id);
        $canonicalPath = '/governorates/'.$id;
        $base = rtrim((string) config('seo.base_url'), '/');
        $canonicalUrl = $base.$canonicalPath;

        $description = $centreAr !== $nameAr
            ? "دليل محافظة {$nameAr} في سوريا (المركز الإداري: {$centreAr}): عدد السكان، المحافظ الحالي، مواقيت الصلاة اليومية وإمساكية رمضان، خطوط المواصلات والمعابر وأرقام الطوارئ."
            : "دليل محافظة {$nameAr} في سوريا ومركزها مدينة {$centreAr}: عدد السكان، المحافظ الحالي، مواقيت الصلاة اليومية وإمساكية رمضان، خطوط المواصلات والمعابر وأرقام الطوارئ.";

        $iconPath = GovernorateDataService::iconPath($id, true);

        $mainEntity = array_filter([
            '@type' => 'AdministrativeArea',
            'name' => 'محافظة '.$nameAr,
            'alternateName' => $nameEn.' Governorate',
            'url' => $canonicalUrl,
            'image' => $iconPath,
            'geo' => [
                '@type' => 'GeoCoordinates',
                'latitude' => (float) $gov['lat'],
                'longitude' => (float) $gov['lng'],
            ],
            'containedInPlace' => [
                '@type' => 'Country',
                'name' => 'الجمهورية العربية السورية',
                'alternateName' => 'Syria',
            ],
        ], fn (mixed $v): bool => $v !== null && $v !== '');

        $extraGraph = [];
        try {
            $governor = app(GovernorateDataService::class)->governorForSeo($id);
            if ($governor !== null) {
                $sameAs = null;
                if (is_string($governor['source_url']) && str_starts_with($governor['source_url'], 'https://')) {
                    $sameAs = $governor['source_url'];
                }

                $portrait = $governor['portrait_url'];
                if (is_string($portrait) && $portrait !== '' && str_starts_with($portrait, '/')) {
                    $portrait = $base.$portrait;
                }

                $extraGraph[] = array_filter([
                    '@type' => 'Person',
                    '@id' => $canonicalUrl.'#governor',
                    'name' => $governor['name_ar'],
                    'jobTitle' => $governor['title_ar'],
                    'url' => $governor['slug'] ? $base.'/govtcvs/'.$governor['slug'] : null,
                    'image' => $portrait ?: null,
                    'sameAs' => $sameAs,
                    'worksFor' => [
                        '@type' => 'GovernmentOrganization',
                        'name' => 'محافظة '.$nameAr,
                    ],
                ], fn (mixed $v): bool => $v !== null && $v !== '');
            }
        } catch (\Throwable) {
            // Never break metadata resolution if governor lookup fails.
        }

        return new Preview(
            title: 'محافظة '.$nameAr.' — السكان والمحافظ ومواقيت الصلاة والخدمات | محافظات سوريا',
            shareTitle: 'محافظة '.$nameAr,
            description: $description,
            canonicalPath: $canonicalPath,
            image: $this->describe($gov)->url(),
            parent: ['/governorates', 'محافظات سوريا'],
            mainEntity: $mainEntity,
            extraGraph: $extraGraph,
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
        $nameAr = (string) $gov['name_ar'];
        $centreAr = GovernorateDataService::centreAr($id);

        return new RecordCard(self::cardType(), $id, [
            'kind' => 'split',
            'url' => $this->address('/governorates/'.$id),
            'kicker' => ['icon' => 'governorates', 'label' => 'محافظات سوريا'],
            'pills' => [
                ['label' => 'المركز: '.$centreAr, 'glyph' => 'MapPin'],
            ],
            'title' => 'محافظة '.$nameAr,
            'subtitle' => 'السكان · المحافظ · مواقيت الصلاة · المواصلات والخدمات',
            'art' => ['type' => 'icon', 'icon' => 'governorates'],
        ]);
    }
}
