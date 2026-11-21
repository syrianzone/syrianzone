<?php

namespace App\Services\GovApps;

use App\Models\GovApp;
use Illuminate\Database\Eloquent\Collection;

/**
 * The single shape a government app is presented in, for the admin UI and for
 * agents. Same contract as the other presenters: one field list, no divergence
 * between what a human sees and what an agent sees.
 */
class GovAppPresenter
{
    /**
     * The public directory page: Arabic-first, with the links shape the page
     * expects even for an app that has none stored.
     *
     * @param  Collection<int, GovApp>  $apps
     * @return array<int, array<string, mixed>>
     */
    public function publicItems(Collection $apps): array
    {
        return $apps->map(fn (GovApp $app) => $this->publicItem($app))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function publicItem(GovApp $app): array
    {
        $entity = $app->relationLoaded('officialEntity') ? $app->officialEntity : null;

        return [
            'id' => $app->id,
            'name' => $app->name_ar ?: $app->name,
            'name_en' => $app->name,
            'description' => $app->description_ar ?: $app->description,
            'icon' => $app->icon,
            'images' => $app->images ?? [],
            'links' => $app->links ?? [
                'official' => null,
                'android' => null,
                'apple' => null,
            ],
            'publisher_name' => $entity?->name_ar ?: $entity?->name,
            'has_rich_guide' => $app->hasRichGuide(),
        ];
    }

    /**
     * Full payload for the dedicated `/govapps/{id}` guide page.
     *
     * @return array<string, mixed>
     */
    public function publicDetail(GovApp $app): array
    {
        $app->loadMissing('officialEntity');
        $entity = $app->officialEntity;
        $links = is_array($app->links) ? $app->links : [];

        return [
            ...$this->publicItem($app),
            'name_ar' => $app->name_ar,
            'description_ar' => $app->description_ar,
            'overview_ar' => $app->overview_ar,
            'features' => is_array($app->features) ? array_values($app->features) : [],
            'requirements' => is_array($app->requirements) ? array_values($app->requirements) : [],
            'faqs' => is_array($app->faqs) ? array_values($app->faqs) : [],
            'verified_at' => $app->verified_at?->toDateString(),
            'updated_at' => $app->updated_at?->toDateString(),
            'publisher' => $entity ? [
                'id' => $entity->id,
                'name_ar' => $entity->name_ar,
                'name' => $entity->name,
                'image' => $entity->image,
                'category_id' => $entity->category_id,
            ] : null,
            'store_identifiers' => $this->extractStoreIdentifiers($links),
        ];
    }

    /**
     * Extract verifiable package / store / domain identifiers from official links
     * so citizens can confirm they are installing the authentic app.
     *
     * @param  array<string, mixed>  $links
     * @return array{android_package: ?string, is_direct_apk: bool, apple_id: ?string, official_host: ?string}
     */
    public function extractStoreIdentifiers(array $links): array
    {
        $android = is_string($links['android'] ?? null) ? trim($links['android']) : null;
        $apple = is_string($links['apple'] ?? null) ? trim($links['apple']) : null;
        $official = is_string($links['official'] ?? null) ? trim($links['official']) : null;

        $androidPackage = null;
        $isDirectApk = false;
        if ($android) {
            if (preg_match('/[?&]id=([A-Za-z0-9._-]+)/', $android, $m)) {
                $androidPackage = $m[1];
            } elseif (str_ends_with(strtolower((string) parse_url($android, PHP_URL_PATH)), '.apk')) {
                $isDirectApk = true;
            }
        }

        $appleId = null;
        if ($apple && preg_match('/\/id(\d+)/', $apple, $m)) {
            $appleId = 'id'.$m[1];
        }

        $officialHost = null;
        if ($official) {
            $host = parse_url($official, PHP_URL_HOST);
            if (is_string($host) && $host !== '') {
                $officialHost = preg_replace('/^www\./i', '', $host);
            }
        }

        return [
            'android_package' => $androidPackage,
            'is_direct_apk' => $isDirectApk,
            'apple_id' => $appleId,
            'official_host' => $officialHost,
        ];
    }

    /**
     * @param  Collection<int, GovApp>  $apps
     * @return array<int, array<string, mixed>>
     */
    public function items(Collection $apps): array
    {
        return $apps->map(fn (GovApp $app) => $this->item($app))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function item(GovApp $app): array
    {
        return [
            'id' => $app->id,
            'name' => $app->name,
            'name_ar' => $app->name_ar,
            'description' => $app->description,
            'description_ar' => $app->description_ar,
            'official_entity_id' => $app->official_entity_id,
            'overview_ar' => $app->overview_ar,
            'features' => is_array($app->features) ? array_values($app->features) : [],
            'requirements' => is_array($app->requirements) ? array_values($app->requirements) : [],
            'faqs' => is_array($app->faqs) ? array_values($app->faqs) : [],
            'verified_at' => $app->verified_at?->toDateString(),
            'has_rich_guide' => $app->hasRichGuide(),
            'icon' => $app->icon,
            'images' => $app->images ?? [],
            'links' => $app->links ?? [],
            'order_column' => $app->order_column,
            'is_active' => $app->is_active,
        ];
    }
}
