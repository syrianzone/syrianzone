<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Services\Ministries\MinistryDirectoryService;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\Arabic;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/**
 * `/ministries/{slug}`: one Syrian ministry (current or historical) or sovereign body.
 */
final class MinistryPreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    private const STATUS_LABELS = [
        'current' => ['قائمة حالياً', 'primary', 'Landmark'],
        'merged' => ['مُدمجة', 'warning', 'CircleDashed'],
        'split' => ['مُقسّمة', 'warning', 'CalendarClock'],
        'abolished' => ['مُلغاة', 'muted', 'MinusCircle'],
    ];

    public function __construct(
        private readonly MinistryDirectoryService $directory,
    ) {}

    public static function cardType(): string
    {
        return 'ministry';
    }

    public static function fallbackCard(): string
    {
        return 'ministries';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        if (! preg_match('#^/ministries/([a-z0-9-]+)$#', $path, $m)) {
            return null;
        }

        $context = $this->directory->seoContext($m[1]);
        if ($context === null) {
            return null;
        }

        $ministry = $context['ministry'];
        $nameAr = (string) $ministry['name_ar'];
        $status = (string) $ministry['status'];
        $kind = (string) $ministry['kind'];
        $current = $ministry['current_holder'];
        $canonicalPath = '/ministries/'.$ministry['slug'];
        $base = rtrim((string) config('seo.base_url'), '/');
        $canonical = $base.$canonicalPath;

        $displayMinistryName = str_contains($nameAr, 'سوري') || str_contains($nameAr, 'السور')
            ? $nameAr
            : ($kind === 'ministry' ? $nameAr.' السورية' : $nameAr);

        if ($kind === 'sovereign') {
            $title = $displayMinistryName.' — القيادة الحالية والتسلسل الزمني والحسابات الرسمية';
        } elseif ($status === 'current') {
            $title = $displayMinistryName.' — الوزير الحالي وتاريخ الوزراء والحسابات الرسمية';
        } else {
            $title = $displayMinistryName.' — تاريخ الوزراء ومسار الدمج والفصل';
        }

        $descriptionParts = [];
        if (is_array($current)) {
            $since = ! empty($current['start_date']) ? ' منذ '.$current['start_date'] : '';
            $descriptionParts[] = 'يشغل منصب '.$current['title'].' حالياً '.$current['name'].$since.'.';
        } elseif (! empty($ministry['lineage_summary_ar'])) {
            $descriptionParts[] = (string) $ministry['lineage_summary_ar'];
        }
        $descriptionParts[] = 'التسلسل الزمني لشاغلي المنصب بين 2024 و2026، سجل المراسيم والدمج والفصل، الحسابات الرسمية والروابط الموثّقة.';
        $description = Arabic::excerpt(implode(' ', $descriptionParts));

        $orgId = $canonical.'#organization';
        $leaderId = $canonical.'#leader';

        $orgNode = array_filter([
            '@type' => 'GovernmentOrganization',
            '@id' => $orgId,
            'name' => $nameAr,
            'alternateName' => ! empty($ministry['name_en']) ? $ministry['name_en'] : null,
            'url' => $context['website'] ?: $canonical,
            'sameAs' => $context['same_as'] !== [] ? $context['same_as'] : null,
            'description' => $description,
            'member' => is_array($current) ? ['@id' => $leaderId] : null,
        ], fn (mixed $v): bool => $v !== null && $v !== '' && $v !== []);

        $extraGraph = [];
        if (is_array($current)) {
            $personNode = array_filter([
                '@type' => 'Person',
                '@id' => $leaderId,
                'name' => $current['name'],
                'jobTitle' => $current['title'],
                'worksFor' => ['@id' => $orgId],
                'url' => ! empty($current['govtcvs_url']) ? $base.$current['govtcvs_url'] : null,
                'image' => ! empty($current['portrait_url']) ? $current['portrait_url'] : null,
            ], fn (mixed $v): bool => $v !== null && $v !== '');
            $extraGraph[] = $personNode;
        }

        return new Preview(
            title: $title.' | وزارات سوريا',
            shareTitle: $nameAr,
            description: $description,
            canonicalPath: $canonicalPath,
            image: $this->describe($ministry)->url(),
            parent: ['/ministries', 'وزارات سوريا'],
            mainEntity: $orgNode,
            extraGraph: $extraGraph,
        );
    }

    public function card(string $key): ?RecordCard
    {
        if ($key === '' || ! preg_match('/^[a-z0-9-]+$/', $key)) {
            return null;
        }

        $context = $this->directory->seoContext($key);

        return $context === null ? null : $this->describe($context['ministry']);
    }

    /**
     * @param  array<string, mixed>  $ministry
     */
    private function describe(array $ministry): RecordCard
    {
        $status = (string) ($ministry['status'] ?? 'current');
        [$statusLabel, $tone, $glyph] = self::STATUS_LABELS[$status] ?? self::STATUS_LABELS['current'];
        $kindLabel = ($ministry['kind'] ?? 'ministry') === 'sovereign' ? 'هيئة سيادية' : 'وزارة سورية';

        $pills = [
            ['label' => $statusLabel, 'tone' => $tone, 'glyph' => $glyph],
            ['label' => $kindLabel],
        ];

        $current = $ministry['current_holder'] ?? null;
        $model = [
            'kind' => 'split',
            'url' => $this->address('/ministries/'.$ministry['slug']),
            'kicker' => ['icon' => 'ministries', 'label' => 'وزارات سوريا'],
            'pills' => $pills,
            'title' => (string) $ministry['name_ar'],
        ];

        if (is_array($current)) {
            $model['person'] = array_filter([
                'name' => $current['name'],
                'role' => $current['title'],
                'image' => $current['portrait_url'] ?? null,
            ]);
        } else {
            $model['art'] = ['type' => 'icon', 'icon' => 'ministries'];
        }

        return new RecordCard(self::cardType(), (string) $ministry['slug'], $model);
    }
}
