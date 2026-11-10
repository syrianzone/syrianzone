<?php

namespace App\Services\Promises;

use App\Exceptions\Promises\PromiseActionException;
use App\Models\Promise;
use App\Models\PromiseSector;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Promise sectors (electricity, housing, …), as staff manage them.
 * Transport-free, so the dashboard and the agent tools share one set of rules.
 *
 * Rules that must not be relaxed:
 *  - A sector's id is its permanent slug; only its label and icon change.
 *  - A sector used by any promise, including a deleted one, cannot be
 *    deleted; hiding it keeps those promises intact.
 *  - New sectors join the end of the order.
 */
class PromiseSectorService
{
    public function find(string $id): PromiseSector
    {
        return PromiseSector::find($id) ?? throw PromiseActionException::notFound('القطاع');
    }

    /** @return Collection<int, PromiseSector> */
    public function list(): Collection
    {
        return PromiseSector::query()->withCount('promises')->orderBy('order_column')->get();
    }

    /** @return array<int, string> every sector id, in display order */
    public function ids(): array
    {
        return PromiseSector::query()->orderBy('order_column')->pluck('id')->all();
    }

    /**
     * @param  array{id: string, label: string, icon?: string|null}  $data  validated input
     */
    public function create(array $data): PromiseSector
    {
        return PromiseSector::create([
            'id' => $data['id'],
            'label' => $data['label'],
            'icon' => $data['icon'] ?? null,
            'order_column' => ((int) PromiseSector::max('order_column')) + 1,
            'is_active' => true,
        ]);
    }

    /**
     * Change the label, and the icon when it is given.
     *
     * @param  array{label: string, icon?: string|null}  $data  validated input
     */
    public function update(PromiseSector $sector, array $data): PromiseSector
    {
        $sector->update(Arr::only($data, ['label', 'icon']));

        return $sector->loadCount('promises');
    }

    public function setActive(PromiseSector $sector, bool $active): PromiseSector
    {
        $sector->update(['is_active' => $active]);

        return $sector->loadCount('promises');
    }

    public function delete(PromiseSector $sector): void
    {
        $count = Promise::withTrashed()->where('sector_id', $sector->id)->count();
        if ($count > 0) {
            throw PromiseActionException::sectorInUse($count);
        }

        $sector->delete();
    }

    /**
     * Number the given sectors in this order, from zero.
     *
     * @param  array<int, string>  $ids
     */
    public function reorder(array $ids): void
    {
        DB::transaction(function () use ($ids) {
            foreach (array_values($ids) as $i => $id) {
                PromiseSector::whereKey($id)->update(['order_column' => $i]);
            }

            // A query-builder update fires no model event, and the sector order
            // is part of the cached /promises payload.
            PromiseIndexCache::flush();
        });
    }
}
