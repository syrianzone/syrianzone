<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Support\Facts;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;

/**
 * Enriches `/syid/logo` and `/syid/flag` with structured data (`ImageObject`
 * for the primary emblem/flag asset, and `FAQPage` for `/syid/flag`) while
 * deriving every other tag from the fixed page table (`resources/data/seo.json`).
 */
final class SyIdPreview implements PreviewResolver
{
    public function resolve(Request $request, string $path): ?Preview
    {
        if ($path !== '/syid/logo' && $path !== '/syid/flag') {
            return null;
        }

        $fixed = SeoMeta::fixedPage($path);
        if ($fixed === null) {
            return null;
        }

        $base = rtrim((string) config('seo.base_url'), '/');
        $facts = Facts::syid();
        $extraGraph = [];

        if ($path === '/syid/logo') {
            $hero = $facts['logo']['hero_image'] ?? [];
            $imageNode = $this->imageObject(
                id: $base.'/syid/logo#emblem',
                contentUrl: $base.(string) ($hero['full_path'] ?? ''),
                pageUrl: $base.'/syid/logo',
                name: (string) ($hero['name_ar'] ?? ''),
                caption: (string) ($hero['caption_ar'] ?? ''),
                creditText: (string) ($hero['credit_text'] ?? ''),
                width: isset($hero['full_width']) ? (int) $hero['full_width'] : null,
                height: isset($hero['full_height']) ? (int) $hero['full_height'] : null,
                creatorName: isset($hero['creator_name']) ? (string) $hero['creator_name'] : null,
            );
            if ($imageNode !== null) {
                $extraGraph[] = $imageNode;
            }
        }

        if ($path === '/syid/flag') {
            $hero = $facts['flag']['hero_image'] ?? [];
            $imageNode = $this->imageObject(
                id: $base.'/syid/flag#flag',
                contentUrl: $base.(string) ($hero['full_path'] ?? ''),
                pageUrl: $base.'/syid/flag',
                name: (string) ($hero['name_ar'] ?? ''),
                caption: (string) ($hero['caption_ar'] ?? ''),
                creditText: (string) ($hero['credit_text'] ?? ''),
                width: isset($hero['full_width']) ? (int) $hero['full_width'] : null,
                height: isset($hero['full_height']) ? (int) $hero['full_height'] : null,
            );
            if ($imageNode !== null) {
                $extraGraph[] = $imageNode;
            }

            $faqNode = $this->faqEntity($facts['flag']['faq'] ?? [], $base.'/syid/flag');
            if ($faqNode !== null) {
                $extraGraph[] = $faqNode;
            }
        }

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
            extraGraph: $extraGraph,
            breadcrumbLabel: $fixed->breadcrumbLabel,
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    private function imageObject(
        string $id,
        string $contentUrl,
        string $pageUrl,
        string $name,
        string $caption,
        string $creditText,
        ?int $width = null,
        ?int $height = null,
        ?string $creatorName = null,
    ): ?array {
        if ($contentUrl === '' || $name === '') {
            return null;
        }

        $node = array_filter([
            '@type' => 'ImageObject',
            '@id' => $id,
            'url' => $contentUrl,
            'contentUrl' => $contentUrl,
            'encodingFormat' => 'image/png',
            'width' => $width,
            'height' => $height,
            'name' => $name,
            'caption' => $caption !== '' ? $caption : null,
            'creditText' => $creditText !== '' ? $creditText : null,
            'representativeOfPage' => true,
            'isPartOf' => ['@id' => $pageUrl.'#webpage'],
            'inLanguage' => 'ar',
        ], static fn (mixed $v): bool => $v !== null && $v !== '');

        if ($creatorName !== null && $creatorName !== '') {
            $node['creator'] = [
                '@type' => 'Organization',
                'name' => $creatorName,
            ];
        }

        return $node;
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
