<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Services\Wildlife\WildlifeData;
use App\Support\Facts;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;

/**
 * The wildlife guide: /wild/{slug}, one species, and /wild, whose fixed entry
 * in resources/data/seo.json gains the list of species as structured data.
 * Reads the same rows the pages get, through WildlifeData.
 */
final class WildSpeciesPreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    /** The guide's name in the breadcrumb, on the page and in structured data alike. */
    private const SECTION = 'الحياة البرية';

    /** Longest description a search snippet shows. */
    private const DESCRIPTION_MAX = 160;

    public function __construct(private readonly WildlifeData $data) {}

    /** Mirrors IUCN_LABELS in `Domain/wildlife/wildlife.ts`. */
    private const IUCN = [
        'EX' => 'منقرض',
        'EW' => 'منقرض في البرية',
        'CR' => 'مهدد بشدة بالانقراض',
        'EN' => 'مهدد بالانقراض',
        'VU' => 'معرّض للانقراض',
        'NT' => 'قريب من التهديد',
        'LC' => 'غير مهدد',
        'DD' => 'بيانات غير كافية',
        'NE' => 'غير مقيَّم',
    ];

    /** Mirrors STATUS_LABELS in `Domain/wildlife/wildlife.ts`. */
    private const STATUS = [
        'resident' => 'مقيم',
        'breeding-visitor' => 'زائر للتكاثر',
        'passage-migrant' => 'عابر في الهجرة',
        'winter-visitor' => 'زائر شتوي',
        'uncertain' => 'وجوده غير مؤكد',
        'possibly-extinct' => 'يُرجَّح انقراضه في سوريا',
        'extinct-in-syria' => 'منقرض في سوريا',
    ];

    public static function cardType(): string
    {
        return 'wild';
    }

    public static function fallbackCard(): string
    {
        return 'wild';
    }

    /** @return array<string, string> */
    public static function iucnLabels(): array
    {
        return self::IUCN;
    }

    /** @return array<string, string> */
    public static function statusLabels(): array
    {
        return self::STATUS;
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        if ($path === '/wild') {
            return $this->hub();
        }

        if (! preg_match('#^/wild/([a-z0-9-]+)$#', $path, $m)) {
            return null;
        }

        $species = $this->data->find($m[1]);
        if ($species === null) {
            return null;
        }

        $canonicalPath = '/wild/'.$species['slug'];
        $status = self::STATUS[$species['syriaStatus']] ?? '';
        $iucn = self::IUCN[$species['iucn']['category'] ?? ''] ?? '';
        $base = rtrim((string) config('seo.base_url'), '/');
        $genus = strtok((string) $species['scientific'], ' ');
        $photo = $this->photoUrl($species);

        return new Preview(
            // The Arabic name is what people search for; the Latin one stays
            // in the heading and in the structured data.
            title: $species['nameAr'].' في سوريا | '.self::SECTION,
            shareTitle: $species['nameAr'],
            description: $this->description($species),
            canonicalPath: $canonicalPath,
            image: $this->describe($species)->url(),
            type: 'article',
            schema: 'Article',
            parent: ['/wild', self::SECTION],
            modified: isset($species['lastReviewed']) ? new \DateTimeImmutable((string) $species['lastReviewed']) : null,
            mainEntity: array_filter([
                '@type' => 'Taxon',
                'name' => $species['scientific'],
                'alternateName' => array_values(array_filter([$species['nameAr'], $species['nameEn'] ?? null, ...($species['altNamesAr'] ?? [])])),
                'taxonRank' => 'species',
                'parentTaxon' => $genus !== false && $genus !== '' ? ['@type' => 'Taxon', 'name' => $genus, 'taxonRank' => 'genus'] : null,
                'description' => trim($status.($iucn !== '' ? ' — التصنيف العالمي: '.$iucn : '')),
                'url' => $base.$canonicalPath,
                'image' => $photo,
                // The Red List page is an assessment of the taxon, not the taxon itself.
                'subjectOf' => isset($species['iucn']['url'])
                    ? ['@type' => 'WebPage', 'name' => 'IUCN Red List assessment', 'url' => $species['iucn']['url']]
                    : null,
            ], fn (mixed $v): bool => $v !== null && $v !== '' && $v !== []),
        );
    }

    /** /wild: its fixed page, with every species as an ItemList. */
    private function hub(): ?Preview
    {
        $page = SeoMeta::fixedPage('/wild');
        if ($page === null) {
            return null;
        }

        $base = rtrim((string) config('seo.base_url'), '/');
        $items = [];
        foreach ($this->data->all() as $index => $species) {
            $items[] = [
                '@type' => 'ListItem',
                'position' => $index + 1,
                'name' => $species['nameAr'],
                'url' => $base.'/wild/'.$species['slug'],
            ];
        }

        return new Preview(
            title: $page->title,
            description: $page->description,
            canonicalPath: $page->canonicalPath,
            image: $page->image,
            type: $page->type,
            noindex: $page->noindex,
            schema: $page->schema,
            parent: $page->parent,
            shareTitle: $page->shareTitle,
            published: $page->published,
            modified: $page->modified,
            mainEntity: [
                '@type' => 'ItemList',
                'numberOfItems' => count($items),
                'itemListElement' => $items,
            ],
            extraGraph: $page->extraGraph,
            breadcrumbLabel: $page->breadcrumbLabel,
            parents: $page->parents,
        );
    }

    public function card(string $key): ?RecordCard
    {
        $species = $this->data->find($key);

        return $species === null ? null : $this->describe($species);
    }

    /**
     * The summary, then (while there is room) the other name people know it
     * by, its standing in Syria and its global category, cut on a word
     * boundary to the length a search snippet shows.
     *
     * @param  array<string, mixed>  $species
     */
    private function description(array $species): string
    {
        // Trailing punctuation goes with a Unicode-aware pattern: rtrim() works
        // on bytes and would cut into an Arabic letter sharing a byte with «،».
        $text = (string) preg_replace('/[.،\s]+$/u', '', (string) $species['summaryAr']);
        $extras = array_filter([
            isset($species['altNamesAr'][0]) ? 'يُعرف أيضاً باسم '.$species['altNamesAr'][0] : null,
            isset(self::STATUS[$species['syriaStatus']]) ? 'الوضع في سوريا: '.self::STATUS[$species['syriaStatus']] : null,
            isset(self::IUCN[$species['iucn']['category'] ?? '']) ? 'التصنيف العالمي: '.self::IUCN[$species['iucn']['category']] : null,
        ]);
        foreach ($extras as $extra) {
            if (mb_strlen($text) + mb_strlen($extra) + 2 > self::DESCRIPTION_MAX) {
                break;
            }
            $text .= '. '.$extra;
        }
        $text .= '.';

        if (mb_strlen($text) <= self::DESCRIPTION_MAX) {
            return $text;
        }

        $cut = mb_substr($text, 0, self::DESCRIPTION_MAX - 3);
        $space = mb_strrpos($cut, ' ');

        return preg_replace('/[.،,\s]+$/u', '', mb_substr($cut, 0, $space === false ? self::DESCRIPTION_MAX - 3 : $space)).'…';
    }

    /**
     * The species' photo on the site's own media store, once mirrored.
     *
     * @param  array<string, mixed>  $species
     */
    private function photoUrl(array $species): ?string
    {
        $r2Key = $species['image']['r2Key'] ?? null;

        return is_string($r2Key) && $r2Key !== ''
            ? rtrim((string) Facts::media()['public_base'], '/').'/'.ltrim($r2Key, '/')
            : null;
    }

    /** @param  array<string, mixed>  $species */
    private function describe(array $species): RecordCard
    {
        // Commons is not an allowed card-image host, so only a photo already
        // mirrored to the site's own media store can be drawn on the card.
        $photo = $this->photoUrl($species);

        $pills = [['label' => self::STATUS[$species['syriaStatus']] ?? '', 'glyph' => 'MapPin']];
        $iucn = self::IUCN[$species['iucn']['category'] ?? ''] ?? null;
        if ($iucn !== null) {
            $pills[] = ['label' => 'عالمياً: '.$iucn, 'glyph' => 'Globe'];
        }

        $model = [
            'kind' => $photo ? 'photo' : 'split',
            'url' => $this->address('/wild/'.$species['slug']),
            'kicker' => ['icon' => 'wild', 'label' => 'الحياة البرية في سوريا'],
            'pills' => $pills,
            'title' => $species['nameAr'],
            'art' => ['type' => 'icon', 'icon' => 'wild'],
        ];
        if ($photo) {
            $model['photo'] = $photo;
        }

        return new RecordCard(self::cardType(), (string) $species['slug'], $model, $photo ? 'jpg' : 'png');
    }
}
