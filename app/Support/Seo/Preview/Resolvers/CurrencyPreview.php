<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Support\Facts;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;

/**
 * Enriches `/currency` with `FAQPage` structured data built from the verified
 * Arabic FAQs in `resources/data/currency.json`, while deriving every other
 * tag from the fixed page table (`resources/data/seo.json`).
 */
final class CurrencyPreview implements PreviewResolver
{
    public function resolve(Request $request, string $path): ?Preview
    {
        if ($path !== '/currency') {
            return null;
        }

        $fixed = SeoMeta::fixedPage('/currency');
        if ($fixed === null) {
            return null;
        }

        $base = rtrim((string) config('seo.base_url'), '/');
        $faqNode = $this->faqEntity(Facts::currency()['faq'] ?? [], $base.'/currency');

        return new Preview(
            title: $fixed->title,
            description: $fixed->description,
            canonicalPath: $fixed->canonicalPath,
            image: $fixed->image,
            type: $fixed->type,
            noindex: $fixed->noindex,
            schema: $fixed->schema,
            parent: $fixed->parent,
            sharePath: $fixed->sharePath,
            shareTitle: $fixed->shareTitle,
            published: $fixed->published,
            modified: $fixed->modified,
            mainEntity: $fixed->mainEntity,
            extraGraph: $faqNode !== null ? [$faqNode] : [],
            breadcrumbLabel: $fixed->breadcrumbLabel,
            parents: $fixed->parents,
        );
    }

    /**
     * Build a Schema.org `FAQPage` node from verified Arabic FAQs.
     *
     * @param  array<int, mixed>  $faqs
     * @return array<string, mixed>|null
     */
    private function faqEntity(array $faqs, string $canonicalUrl): ?array
    {
        $questions = [];
        foreach ($faqs as $faq) {
            if (! is_array($faq)) {
                continue;
            }
            $q = trim((string) ($faq['question_ar'] ?? ''));
            $a = trim((string) ($faq['answer_ar'] ?? ''));
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

        return [
            '@type' => 'FAQPage',
            '@id' => $canonicalUrl.'#faq',
            'mainEntity' => $questions,
        ];
    }
}
