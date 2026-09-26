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
