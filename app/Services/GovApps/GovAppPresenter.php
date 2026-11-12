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
        return [
            'id' => $app->id,
            'name' => $app->name_ar ?: $app->name,
            'description' => $app->description_ar ?: $app->description,
            'icon' => $app->icon,
            'images' => $app->images ?? [],
            'links' => $app->links ?? [
                'official' => null,
                'android' => null,
                'apple' => null,
            ],
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
            'icon' => $app->icon,
            'images' => $app->images ?? [],
            'links' => $app->links ?? [],
            'order_column' => $app->order_column,
            'is_active' => $app->is_active,
        ];
    }
}
