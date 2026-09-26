<?php

namespace App\Services\SyOfficial;

use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use Illuminate\Database\Eloquent\Collection;

/**
 * The single shape SyOfficial records are presented in, for both the admin UI
 * and agents.
 *
 * Same reasoning as PlacePresenter: a human and an agent looking at the same
 * directory must see the same field names, or a change made by one is invisible
 * to the other.
 *
 * Everything here is derived from columns already on the two tables. No new
 * queries, so presenting a listing stays a single read.
 */
class SyOfficialPresenter
{
    /**
     * @param  Collection<int, OfficialCategory>  $categories
     * @return array<int, array<string, mixed>>
     */
    public function categories(Collection $categories): array
    {
        return $categories->map(fn (OfficialCategory $c) => [
            'id' => $c->id,
            'label_ar' => $c->label_ar,
            'label_en' => $c->label_en,
            'icon' => $c->icon,
            'order_column' => $c->order_column,
            'is_active' => $c->is_active,
        ])->values()->all();
    }

    /**
     * @param  Collection<int, OfficialEntity>  $entities
     * @return array<int, array<string, mixed>>
     */
    public function entities(Collection $entities): array
    {
        return $entities->map(fn (OfficialEntity $e) => $this->entity($e))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function entity(OfficialEntity $entity): array
    {
        return [
            'id' => $entity->id,
            'category_id' => $entity->category_id,
            'category_label_ar' => $entity->relationLoaded('category') ? $entity->category?->label_ar : null,
            'category_label_en' => $entity->relationLoaded('category') ? $entity->category?->label_en : null,
            'name' => $entity->name,
            'name_ar' => $entity->name_ar,
            'description' => $entity->description,
            'description_ar' => $entity->description_ar,
            'image' => $entity->image,
            'socials' => $entity->socials ?? [],
            'order_column' => $entity->order_column,
            'is_active' => $entity->is_active,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function category(OfficialCategory $category): array
    {
        return $this->categories(new Collection([$category]))[0];
    }
}
