<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Support\Facts;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/**
 * /crossings?c={n}: one border crossing or port, the link its share message
 * carries. The data ships with the page as JSON, so it is read from the same file.
 */
final class CrossingPreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    private const KINDS = [
        'crossing' => ['منفذ برّي', 'Car'],
        'port' => ['مرفأ بحري', 'Ship'],
    ];

    public static function cardType(): string
    {
        return 'crossing';
    }

    public static function fallbackCard(): string
    {
        return 'crossings';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        $crossing = null;
        $viaQuery = false;

        if (preg_match('#^/crossings/([a-z0-9-]+)$#', $path, $m)) {
            $crossing = $this->findBySlug($m[1]);
        } elseif ($path === '/crossings') {
            $number = $request->query('c');
            if (is_string($number) && ctype_digit($number)) {
                $crossing = $this->find((int) $number);
                $viaQuery = true;
            }
        }

        if ($crossing === null) {
            return null;
        }

        [$kind] = self::KINDS[$crossing['category'] ?? ''] ?? self::KINDS['crossing'];
        $with = empty($crossing['country']) ? '' : ' مع '.$crossing['country'];
        $slug = (string) ($crossing['slug'] ?? $crossing['n']);
        $canonicalPath = '/crossings/'.$slug;
        $opPart = ! empty($crossing['opType']) ? ' — حركة: '.$crossing['opType'].'.' : '.';
        $hoursText = $this->hoursSentence($crossing);

        return new Preview(
            title: $crossing['name'].' — ساعات العمل والواتساب والموقع | المنافذ الحدودية',
            shareTitle: $crossing['name'],
            description: $kind.$with.$opPart.' '.$hoursText.' رقم الواتساب الرسمي والموقع على الخريطة.',
            canonicalPath: $canonicalPath,
            image: $this->describe($crossing)->url(),
            parent: ['/crossings', 'المنافذ الحدودية'],
            sharePath: $viaQuery ? '/crossings?c='.$crossing['n'] : $canonicalPath,
            mainEntity: $this->civicEntity($crossing, $kind),
        );
    }

    public function card(string $key): ?RecordCard
    {
        $crossing = ctype_digit($key) ? $this->find((int) $key) : $this->findBySlug($key);

        return $crossing === null ? null : $this->describe($crossing);
    }

    /** @return array<string, mixed>|null */
    private function find(int $number): ?array
    {
        foreach (Facts::json('crossings')['crossings'] ?? [] as $crossing) {
            if (($crossing['n'] ?? null) === $number) {
                return $crossing;
            }
        }

        return null;
    }

    /** @return array<string, mixed>|null */
    private function findBySlug(string $slug): ?array
    {
        foreach (Facts::json('crossings')['crossings'] ?? [] as $crossing) {
            if (($crossing['slug'] ?? null) === $slug) {
                return $crossing;
            }
        }

        return null;
    }

    /** @param  array<string, mixed>  $crossing */
    private function hoursSentence(array $crossing): string
    {
        if (! empty($crossing['openingSoon'])) {
            return 'المنفذ حالياً قيد الافتتاح.';
        }

        $windows = is_array($crossing['windows'] ?? null) ? $crossing['windows'] : [];
        if ($windows === []) {
            return 'متابعة الحالة الفنية وساعات العمل.';
        }

        $parts = [];
        foreach ($windows as $win) {
            if (! is_array($win)) {
                continue;
            }
            $label = ! empty($win['label']) ? $win['label'].': ' : '';
            if (! empty($win['h24'])) {
                $parts[] = $label.'على مدار الساعة (24/7)';
            } elseif (! empty($win['start']) && ! empty($win['end'])) {
                $parts[] = $label.$win['start'].' – '.$win['end'];
            }
        }

        return $parts !== [] ? 'ساعات العمل: '.implode('، ', $parts).'.' : 'متابعة الحالة الفنية وساعات العمل.';
    }

    /**
     * Build a Schema.org `CivicStructure` node for one crossing or maritime port.
     *
     * @param  array<string, mixed>  $crossing
     * @return array<string, mixed>
     */
    private function civicEntity(array $crossing, string $kind): array
    {
        $intl = ! empty($crossing['intl']) ? '+'.$crossing['intl'] : null;
        $windows = is_array($crossing['windows'] ?? null) ? $crossing['windows'] : [];
        $openingHours = [];
        foreach ($windows as $win) {
            if (! is_array($win)) {
                continue;
            }
            if (! empty($win['h24'])) {
                $openingHours[] = 'Mo-Su 00:00-23:59';
            } elseif (! empty($win['start']) && ! empty($win['end'])) {
                $openingHours[] = 'Mo-Su '.$win['start'].'-'.$win['end'];
            }
        }

        return array_filter([
            '@type' => 'CivicStructure',
            'name' => $crossing['name'],
            'description' => $kind.(! empty($crossing['country']) ? ' مع '.$crossing['country'] : '').(! empty($crossing['opType']) ? ' — '.$crossing['opType'] : ''),
            'telephone' => $intl,
            'hasMap' => $crossing['mapsUrl'] ?? null,
            'openingHours' => $openingHours !== [] ? $openingHours : null,
            'geo' => (isset($crossing['lat'], $crossing['lon'])) ? [
                '@type' => 'GeoCoordinates',
                'latitude' => $crossing['lat'],
                'longitude' => $crossing['lon'],
            ] : null,
            'address' => [
                '@type' => 'PostalAddress',
                'addressCountry' => 'SY',
            ],
        ], fn (mixed $v): bool => $v !== null && $v !== '' && $v !== []);
    }

    /** @param  array<string, mixed>  $crossing */
    private function describe(array $crossing): RecordCard
    {
        [$kind, $glyph] = self::KINDS[$crossing['category'] ?? ''] ?? self::KINDS['crossing'];

        // Type, neighbour and traffic are stable facts. Open or closed is not
        // shown: it changes by the hour and a cached preview would mislead.
        $pills = [['label' => $kind, 'glyph' => $glyph]];
        if (! empty($crossing['country'])) {
            $pills[] = ['label' => $crossing['country'], 'glyph' => 'Globe'];
        }
        if (! empty($crossing['opType'])) {
            $pills[] = ['label' => $crossing['opType']];
        }

        return new RecordCard(self::cardType(), (string) $crossing['n'], [
            'kind' => 'split',
            'url' => $this->address('/crossings'),
            'kicker' => ['icon' => 'crossings', 'label' => 'المنافذ الحدودية'],
            'pills' => $pills,
            'title' => $crossing['name'],
            'art' => ['type' => 'icon', 'icon' => 'crossings'],
        ]);
    }
}
