<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Services\Places\PlaceHubService;
use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/**
 * /mishwar/{governorate} and /mishwar/{governorate}/{category} hub pages.
 */
final class PlaceHubPreview implements PreviewResolver
{
    public function __construct(private readonly PlaceHubService $hubs) {}

    public function resolve(Request $request, string $path): ?Preview
    {
        if (preg_match('#^/mishwar/([a-z-]+)$#', $path, $m)) {
            $data = $this->hubs->forGovernorate($m[1]);
            if ($data === null) {
                return null;
            }

            $gov = $data['governorate'];

            return $this->buildPreview(
                data: $data,
                canonicalPath: '/mishwar/'.$gov['id'],
                parents: [['/mishwar', 'مشوار']],
                breadcrumbLabel: (string) $gov['name_ar'],
            );
        }

        if (preg_match('#^/mishwar/([a-z-]+)/([a-z]+)$#', $path, $m)) {
            $result = $this->hubs->forCategory($m[1], $m[2]);
            if ($result['status'] !== 'ok') {
                return null;
            }

            $data = $result['data'];
            $gov = $data['governorate'];
            $cat = $data['category'];

            return $this->buildPreview(
                data: $data,
                canonicalPath: '/mishwar/'.$gov['id'].'/'.$cat['key'],
                parents: [
                    ['/mishwar', 'مشوار'],
                    ['/mishwar/'.$gov['id'], (string) $gov['name_ar']],
                ],
                breadcrumbLabel: (string) $cat['label'],
            );
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<array{0:string,1:string}>  $parents
     */
    private function buildPreview(array $data, string $canonicalPath, array $parents, string $breadcrumbLabel): Preview
    {
        $base = rtrim((string) config('seo.base_url'), '/');
        $itemListElements = [];
        foreach ($data['place_items'] as $index => $item) {
            $itemListElements[] = [
                '@type' => 'ListItem',
                'position' => $index + 1,
                'name' => $item['name'],
                'url' => $base.$item['path'],
            ];
        }

        return new Preview(
            title: $data['h1'].' | مشوار',
            shareTitle: $data['h1'],
            description: $data['description'],
            canonicalPath: $canonicalPath,
            image: StaticCards::url('mishwar'),
            noindex: ! $data['indexable'],
            schema: 'CollectionPage',
            mainEntity: [
                '@type' => 'ItemList',
                'numberOfItems' => count($itemListElements),
                'itemListElement' => $itemListElements,
            ],
            breadcrumbLabel: $breadcrumbLabel,
            parents: $parents,
        );
    }
}
