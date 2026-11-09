<?php

namespace App\Services\Promises;

use App\Models\OfficialEntity;
use App\Models\Promise;
use App\Models\PromiseSector;
use App\Models\PromiseSource;
use App\Support\Governorates;

/**
 * Editorial form options shared between the dashboard and MCP tools.
 */
class PromiseFormOptions
{
    /**
     * @return array<string, mixed>
     */
    public function forEditor(?Promise $current = null): array
    {
        return [
            'sectors' => PromiseSector::orderBy('order_column')->get()->map->toOption()->all(),
            'governorates' => Governorates::options(),
            'institutions' => $this->institutions(),
            'venues' => Promise::VENUES,
            'sourceTypes' => PromiseSource::TYPES,
            'statuses' => Promise::STATUSES,
            'earliestDate' => Promise::EARLIEST_STATEMENT_DATE,
            'today' => Promise::today()->format('Y-m-d'),
            // Candidates for "this restates promise #N": published, not itself.
            'restatable' => Promise::published()
                ->when($current, fn ($q) => $q->whereKeyNot($current->id))
                ->orderByDesc('number')
                ->get(['id', 'number', 'title'])
                ->map(fn (Promise $p) => ['id' => $p->id, 'number' => $p->number, 'title' => $p->title])
                ->all(),
        ];
    }

    /**
     * Institutions: officials-directory entries that are bodies, not people.
     *
     * @return array<int, array{id: string, name: string}>
     */
    public function institutions(): array
    {
        return OfficialEntity::query()
            ->whereNotIn('category_id', SpeakerDirectory::PEOPLE_CATEGORIES)
            ->where('is_active', true)
            ->orderBy('category_id')
            ->orderBy('order_column')
            ->get(['id', 'name', 'name_ar'])
            ->map(fn (OfficialEntity $e) => ['id' => $e->id, 'name' => $e->name_ar ?: $e->name])
            ->all();
    }
}
