<?php

namespace App\Support\Seo\Preview\Resolvers;

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
        $number = $request->query('c');
        if ($path !== '/crossings' || ! is_string($number) || ! ctype_digit($number)) {
            return null;
        }

        $crossing = $this->find((int) $number);
        if ($crossing === null) {
            return null;
        }

        [$kind] = self::KINDS[$crossing['category'] ?? ''] ?? self::KINDS['crossing'];
        $with = empty($crossing['country']) ? '' : ' مع '.$crossing['country'];

        return new Preview(
            title: $crossing['name'].' | المنافذ الحدودية',
            description: $kind.$with.': الحالة وساعات العمل وأرقام التواصل والموقع على الخريطة.',
            canonicalPath: '/crossings',
            image: $this->describe($crossing)->url(),
            sharePath: '/crossings?c='.$crossing['n'],
        );
    }

    public function card(string $key): ?RecordCard
    {
        $crossing = ctype_digit($key) ? $this->find((int) $key) : null;

        return $crossing === null ? null : $this->describe($crossing);
    }

    /** @return array<string, mixed>|null */
    private function find(int $number): ?array
    {
        $file = resource_path('js/Pages/Crossings/_data/crossings.json');
        $data = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;

        foreach ($data['crossings'] ?? [] as $crossing) {
            if (($crossing['n'] ?? null) === $number) {
                return $crossing;
            }
        }

        return null;
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
