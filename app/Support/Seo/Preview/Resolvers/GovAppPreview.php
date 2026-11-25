<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Models\GovApp;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\Arabic;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;

/** /govapps/{id}: dedicated verified guide and download page for one government app. */
final class GovAppPreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    public static function cardType(): string
    {
        return 'govapp';
    }

    public static function fallbackCard(): string
    {
        return 'govapps';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        if (! preg_match('#^/govapps/([a-z0-9-]+)$#', $path, $m)) {
            return null;
        }

        $app = SeoMeta::remembered($request, 'govapp') ?? $this->find($m[1]);
        if ($app === null) {
            return null;
        }

        $name = $app->name_ar ?: $app->name;
        $publisherName = $app->officialEntity?->name_ar ?: $app->officialEntity?->name;

        $pageTitle = $name.' — التحميل الرسمي | تطبيقات حكومية';
        $descriptionSource = $app->overview_ar
            ?: $app->description_ar
            ?: $app->description
            ?: $name;
        $description = Arabic::excerpt($descriptionSource);

        $extraGraph = [];
        if ($app->hasRichGuide()) {
            $faqNode = $this->faqEntity($app, '/govapps/'.$app->id);
            if ($faqNode !== null) {
                $extraGraph[] = $faqNode;
            }
        }

        return new Preview(
            title: $pageTitle,
            shareTitle: $name,
            description: $description,
            canonicalPath: $app->hasRichGuide() ? '/govapps/'.$app->id : '/govapps',
            sharePath: '/govapps/'.$app->id,
            image: $this->describe($app)->url(),
            type: 'article',
            schema: 'WebPage',
            parent: ['/govapps', 'تطبيقات حكومية'],
            modified: $app->updated_at,
            mainEntity: $this->softwareEntity($app, $name, $publisherName, $description),
            extraGraph: $extraGraph,
        );
    }

    public function card(string $key): ?RecordCard
    {
        if ($key === '' || ! preg_match('/^[a-z0-9-]+$/', $key)) {
            return null;
        }

        $app = $this->find($key);

        return $app === null ? null : $this->describe($app);
    }

    private function find(string $id): ?GovApp
    {
        return GovApp::with('officialEntity')
            ->where('id', $id)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Build a Schema.org `SoftwareApplication` node for rich search snippets.
     *
     * @return array<string, mixed>
     */
    private function softwareEntity(GovApp $app, string $name, ?string $publisherName, string $description): array
    {
        $links = is_array($app->links) ? $app->links : [];
        $os = [];
        if (! empty($links['android'])) {
            $os[] = 'Android';
        }
        if (! empty($links['apple'])) {
            $os[] = 'iOS';
        }
        if (! empty($links['official'])) {
            $os[] = 'Web';
        }

        $downloadUrl = $links['android'] ?? $links['apple'] ?? $links['official'] ?? null;

        return array_filter([
            '@type' => 'SoftwareApplication',
            'name' => $name,
            'alternateName' => ($app->name && $app->name !== $name) ? $app->name : null,
            'applicationCategory' => 'GovernmentService',
            'operatingSystem' => $os !== [] ? implode(', ', $os) : null,
            'description' => $description !== '' ? $description : null,
            'image' => $app->icon ?: null,
            'downloadUrl' => $downloadUrl,
            'offers' => [
                '@type' => 'Offer',
                'price' => '0',
                'priceCurrency' => 'SYP',
            ],
            'publisher' => $publisherName ? [
                '@type' => 'GovernmentOrganization',
                'name' => $publisherName,
            ] : null,
        ], fn (mixed $value): bool => $value !== null && $value !== '' && $value !== []);
    }

    /**
     * Build a Schema.org `FAQPage` node from the app's verified Arabic FAQs.
     *
     * @return array<string, mixed>|null
     */
    private function faqEntity(GovApp $app, string $canonicalPath): ?array
    {
        $faqs = is_array($app->faqs) ? $app->faqs : [];
        $questions = [];
        foreach ($faqs as $faq) {
            if (! is_array($faq)) {
                continue;
            }
            $q = trim((string) ($faq['q'] ?? ''));
            $a = trim((string) ($faq['a'] ?? ''));
            if ($q === '' || $a === '') {
                continue;
            }
            $questions[] = [
                '@type' => 'Question',
                'name' => $q,
                'acceptedAnswer' => [
                    '@type' => 'Answer',
                    'text' => $a,
                ],
            ];
        }

        if ($questions === []) {
            return null;
        }

        $base = rtrim((string) config('seo.base_url'), '/');

        return [
            '@type' => 'FAQPage',
            '@id' => $base.$canonicalPath.'#faq',
            'mainEntity' => $questions,
        ];
    }

    private function describe(GovApp $app): RecordCard
    {
        $links = is_array($app->links) ? $app->links : [];
        $pills = [];
        if (! empty($links['android'])) {
            $pills[] = ['label' => 'أندرويد', 'tone' => 'primary'];
        }
        if (! empty($links['apple'])) {
            $pills[] = ['label' => 'آيفون', 'tone' => 'primary'];
        }
        if (! empty($links['official'])) {
            $pills[] = ['label' => 'الموقع الرسمي'];
        }

        $name = $app->name_ar ?: $app->name;
        $publisherName = $app->officialEntity?->name_ar ?: $app->officialEntity?->name;

        $model = [
            'kind' => 'split',
            'url' => $this->address('/govapps/'.$app->id),
            'kicker' => ['icon' => 'govapps', 'label' => 'تطبيقات حكومية'],
            'pills' => $pills,
            'title' => $name,
            'person' => array_filter([
                'name' => $publisherName ?: $app->name,
                'role' => Arabic::excerpt($app->description_ar ?: $app->description ?: '', 80),
                'image' => $app->icon ?: null,
            ]),
        ];

        return new RecordCard(self::cardType(), $app->id, $model);
    }
}
