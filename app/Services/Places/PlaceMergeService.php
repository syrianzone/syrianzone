<?php

namespace App\Services\Places;

use App\Exceptions\Places\PlaceActionException;
use App\Models\Place;
use App\Models\PlacePhoto;
use App\Models\PlaceReport;
use App\Models\PlaceSave;
use App\Services\IndexNow\IndexNow;
use Illuminate\Support\Facades\DB;

/**
 * Merges an approved duplicate Mishwar place (`source`) into another approved
 * place (`target`), transport-free so both the MCP surface and a future admin
 * dashboard action can share one implementation.
 *
 * What a merge does:
 *  - Appends the source's photos to the target in `sort` order up to
 *    PlaceModerationService::MAX_PHOTOS_PER_PLACE; photos past the cap stay on
 *    the source and are listed in the result.
 *  - Moves `place_saves` without duplicating a user's save, then recomputes
 *    `saves_count` on both places from the table.
 *  - Moves open `place_reports` from the source to the target when the reporter
 *    has not already reported the target; conflicting open reports on the source
 *    are marked `resolved` (avoiding the unique(place_id, user_id) constraint
 *    and keeping open reports off the retired duplicate).
 *  - Optionally copies the source's description (`keep_description`:
 *    "target" | "source" | "longer").
 *  - Marks the source `status = 'rejected'` with `merged_into_id = target.id`
 *    so it disappears from the map, lists, hubs and sitemaps while 301ing all
 *    old URLs (`/mishwar/{id}-*`, `/mishwar/{id}`, `/mishwar?place={id}`) to
 *    the canonical target, including chains (A -> B -> C).
 *  - Busts the map / governorate caches and queues IndexNow for the source path,
 *    the target path, `/mishwar`, and every affected governorate/category hub.
 */
final class PlaceMergeService
{
    public const KEEP_TARGET = 'target';

    public const KEEP_SOURCE = 'source';

    public const KEEP_LONGER = 'longer';

    /** @var list<string> */
    public const KEEP_DESCRIPTION_OPTIONS = [
        self::KEEP_TARGET,
        self::KEEP_SOURCE,
        self::KEEP_LONGER,
    ];

    public function __construct(
        private readonly PlaceGovernorates $governorates,
        private readonly IndexNow $indexNow,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function merge(
        int $sourceId,
        int $targetId,
        string $keepDescription = self::KEEP_TARGET,
        bool $dryRun = true,
    ): array {
        if ($sourceId === $targetId) {
            throw PlaceActionException::cannotMergeSamePlace($sourceId);
        }

        if (! in_array($keepDescription, self::KEEP_DESCRIPTION_OPTIONS, true)) {
            throw PlaceActionException::invalidMergeOption('keep_description', $keepDescription);
        }

        if ($dryRun) {
            $source = $this->findOrFail($sourceId);
            $target = $this->findOrFail($targetId);
            $this->assertMergeable($source, $target);

            $plan = $this->buildPlan($source, $target, $keepDescription);

            return $this->formatResult($source, $target, $plan, dryRun: true, indexNowPaths: $this->indexNowPaths($source, $target));
        }

        $indexNowPaths = [];

        /** @var array{source: Place, target: Place, plan: array<string, mixed>} $outcome */
        $outcome = DB::transaction(function () use ($sourceId, $targetId, $keepDescription, &$indexNowPaths): array {
            // Lock both rows in ascending id order so concurrent merges cannot deadlock.
            $firstId = min($sourceId, $targetId);
            $secondId = max($sourceId, $targetId);

            $first = Place::whereKey($firstId)->lockForUpdate()->first();
            $second = Place::whereKey($secondId)->lockForUpdate()->first();

            $source = $sourceId === $firstId ? $first : $second;
            $target = $targetId === $firstId ? $first : $second;

            if ($source === null) {
                throw PlaceActionException::notFound($sourceId);
            }
            if ($target === null) {
                throw PlaceActionException::notFound($targetId);
            }

            $this->assertMergeable($source, $target);

            $indexNowPaths = $this->indexNowPaths($source, $target);
            $plan = $this->buildPlan($source, $target, $keepDescription);

            // 1. Move photos up to the place photo cap, preserving source sort order.
            $nextSort = $plan['next_sort'];
            foreach ($plan['photos_to_move'] as $photoId) {
                PlacePhoto::whereKey($photoId)->update([
                    'place_id' => $target->id,
                    'sort' => $nextSort++,
                ]);
            }

            // 2. Move saves without duplicating (place_id, user_id) rows.
            if ($plan['save_user_ids_to_move'] !== []) {
                PlaceSave::where('place_id', $source->id)
                    ->whereIn('user_id', $plan['save_user_ids_to_move'])
                    ->update(['place_id' => $target->id]);
            }
            if ($plan['save_user_ids_duplicate'] !== []) {
                PlaceSave::where('place_id', $source->id)
                    ->whereIn('user_id', $plan['save_user_ids_duplicate'])
                    ->delete();
            }

            $recomputedTargetSaves = PlaceSave::where('place_id', $target->id)->count();
            $plan['target_saves_after'] = $recomputedTargetSaves;

            // 3. Move open reports to the target (deduplicating per reporter);
            //    conflicting open reports on the source are marked resolved.
            if ($plan['report_ids_to_move'] !== []) {
                PlaceReport::whereIn('id', $plan['report_ids_to_move'])
                    ->update(['place_id' => $target->id]);
            }
            if ($plan['report_ids_to_resolve'] !== []) {
                PlaceReport::whereIn('id', $plan['report_ids_to_resolve'])
                    ->update(['status' => 'resolved']);
            }

            // 4. Update target (saves_count + optional description; Eloquent save keeps description_fold in sync).
            $target->saves_count = $recomputedTargetSaves;
            if ($plan['description_changed']) {
                $target->description = $plan['resulting_description'];
            }
            $target->save();

            // 5. Mark source as merged (rejected + merged_into_id) so it leaves
            //    public lists/sitemaps while 301ing to the canonical target.
            $source->status = 'rejected';
            $source->merged_into_id = $target->id;
            $source->approved_at = null;
            $source->saves_count = 0;
            $source->rejection_reason = sprintf('تم دمجه مع المكان #%d (%s)', $target->id, $target->name);
            $source->save();

            return [
                'source' => $source,
                'target' => $target,
                'plan' => $plan,
            ];
        });

        // Outside the transaction: drop caches and queue IndexNow only after commit.
        PlaceModerationService::forgetMapCache();
        $this->indexNow->queue($indexNowPaths);

        return $this->formatResult(
            $outcome['source'],
            $outcome['target'],
            $outcome['plan'],
            dryRun: false,
            indexNowPaths: $indexNowPaths,
        );
    }

    private function findOrFail(int $id): Place
    {
        $place = Place::find($id);

        if ($place === null) {
            throw PlaceActionException::notFound($id);
        }

        return $place;
    }

    private function assertMergeable(Place $source, Place $target): void
    {
        if ($source->merged_into_id !== null) {
            throw PlaceActionException::alreadyMerged((int) $source->id, (int) $source->merged_into_id);
        }

        if ($source->status !== 'approved') {
            throw PlaceActionException::mergeRequiresApproved('source', (int) $source->id, (string) $source->status);
        }

        if ($target->merged_into_id !== null) {
            throw PlaceActionException::alreadyMerged((int) $target->id, (int) $target->merged_into_id);
        }

        if ($target->status !== 'approved') {
            throw PlaceActionException::mergeRequiresApproved('target', (int) $target->id, (string) $target->status);
        }
    }

    /**
     * Compute the exact mutations a merge will perform without writing anything.
     *
     * @return array<string, mixed>
     */
    private function buildPlan(Place $source, Place $target, string $keepDescription): array
    {
        $targetPhotos = $target->photos()->orderBy('sort')->orderBy('id')->get(['id', 'sort']);
        $sourcePhotos = $source->photos()->orderBy('sort')->orderBy('id')->get(['id', 'sort']);

        $availableSlots = max(0, PlaceModerationService::MAX_PHOTOS_PER_PLACE - $targetPhotos->count());
        $photosToMove = $sourcePhotos->take($availableSlots)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        $photosLeftBehind = $sourcePhotos->slice($availableSlots)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        $nextSort = $targetPhotos->isEmpty() ? 0 : ((int) $targetPhotos->max('sort') + 1);

        $sourceSaveUserIds = PlaceSave::where('place_id', $source->id)->pluck('user_id')->map(fn ($id) => (int) $id)->all();
        $targetSaveUserIds = PlaceSave::where('place_id', $target->id)->pluck('user_id')->map(fn ($id) => (int) $id)->all();

        $saveUserIdsToMove = array_values(array_diff($sourceSaveUserIds, $targetSaveUserIds));
        $saveUserIdsDuplicate = array_values(array_intersect($sourceSaveUserIds, $targetSaveUserIds));

        $openSourceReports = PlaceReport::where('place_id', $source->id)
            ->where('status', 'open')
            ->get(['id', 'user_id']);
        $targetReporterIds = PlaceReport::where('place_id', $target->id)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $targetReporterLookup = array_flip($targetReporterIds);

        $reportIdsToMove = [];
        $reportIdsToResolve = [];
        foreach ($openSourceReports as $report) {
            if (isset($targetReporterLookup[(int) $report->user_id])) {
                $reportIdsToResolve[] = (int) $report->id;
            } else {
                $reportIdsToMove[] = (int) $report->id;
                $targetReporterLookup[(int) $report->user_id] = true;
            }
        }

        $sourceDescription = (string) $source->description;
        $targetDescription = (string) $target->description;
        $adoptSourceDescription = match ($keepDescription) {
            self::KEEP_SOURCE => $sourceDescription !== $targetDescription,
            self::KEEP_LONGER => mb_strlen(trim($sourceDescription)) > mb_strlen(trim($targetDescription)),
            default => false,
        };

        $resultingDescription = $adoptSourceDescription ? $sourceDescription : $targetDescription;

        return [
            'photo_limit' => PlaceModerationService::MAX_PHOTOS_PER_PLACE,
            'target_photos_before' => $targetPhotos->count(),
            'source_photos_before' => $sourcePhotos->count(),
            'photos_to_move' => $photosToMove,
            'photos_left_on_source' => $photosLeftBehind,
            'target_photos_after' => $targetPhotos->count() + count($photosToMove),
            'next_sort' => $nextSort,
            'save_user_ids_to_move' => $saveUserIdsToMove,
            'save_user_ids_duplicate' => $saveUserIdsDuplicate,
            'target_saves_before' => (int) $target->saves_count,
            'target_saves_after' => count($targetSaveUserIds) + count($saveUserIdsToMove),
            'report_ids_to_move' => $reportIdsToMove,
            'report_ids_to_resolve' => $reportIdsToResolve,
            'keep_description' => $keepDescription,
            'description_changed' => $adoptSourceDescription,
            'description_source_kept' => $adoptSourceDescription ? 'source' : 'target',
            'resulting_description' => $resultingDescription,
        ];
    }

    /**
     * Source path, target path, `/mishwar`, and every governorate/category hub
     * touched by either place.
     *
     * @return list<string>
     */
    private function indexNowPaths(Place $source, Place $target): array
    {
        $paths = [
            $source->publicPath(),
            $target->publicPath(),
            '/mishwar',
        ];

        foreach ([$source, $target] as $place) {
            $gov = $this->governorates->forPlace($place);
            if ($gov !== null) {
                $paths[] = '/mishwar/'.$gov;
                $category = (string) $place->category;
                if ($category !== '' && $category !== 'other') {
                    $paths[] = '/mishwar/'.$gov.'/'.$category;
                }
            }
        }

        return array_values(array_unique($paths));
    }

    /**
     * @param  array<string, mixed>  $plan
     * @param  list<string>  $indexNowPaths
     * @return array<string, mixed>
     */
    private function formatResult(
        Place $source,
        Place $target,
        array $plan,
        bool $dryRun,
        array $indexNowPaths,
    ): array {
        return [
            'dry_run' => $dryRun,
            'applied' => ! $dryRun,
            'source' => [
                'id' => (int) $source->id,
                'name' => (string) $source->name,
                'url' => $source->publicPath(),
                'status_after' => 'rejected',
                'merged_into_id' => (int) $target->id,
            ],
            'target' => [
                'id' => (int) $target->id,
                'name' => (string) $target->name,
                'url' => $target->publicPath(),
            ],
            'redirect' => [
                'from' => $source->publicPath(),
                'to' => $target->publicPath(),
                'status' => 301,
            ],
            'photos' => [
                'limit' => $plan['photo_limit'],
                'moved_count' => count($plan['photos_to_move']),
                'moved_ids' => $plan['photos_to_move'],
                'left_on_source_count' => count($plan['photos_left_on_source']),
                'left_on_source_ids' => $plan['photos_left_on_source'],
                'target_before' => $plan['target_photos_before'],
                'target_after' => $plan['target_photos_after'],
            ],
            'saves' => [
                'moved_count' => count($plan['save_user_ids_to_move']),
                'deduplicated_count' => count($plan['save_user_ids_duplicate']),
                'target_before' => $plan['target_saves_before'],
                'target_after' => $plan['target_saves_after'],
            ],
            'reports' => [
                'policy' => 'open_moved_to_target_conflicts_resolved',
                'moved_count' => count($plan['report_ids_to_move']),
                'moved_ids' => $plan['report_ids_to_move'],
                'resolved_conflicts_count' => count($plan['report_ids_to_resolve']),
                'resolved_conflict_ids' => $plan['report_ids_to_resolve'],
            ],
            'description' => [
                'mode' => $plan['keep_description'],
                'changed' => $plan['description_changed'],
                'kept' => $plan['description_source_kept'],
            ],
            'indexnow_paths' => $indexNowPaths,
        ];
    }
}
