<?php

namespace App\Services;

use App\Models\Place;
use App\Models\PlacePhoto;
use Illuminate\Support\Facades\Cache;

class GuideLevelService
{
    // level => points required; level = highest key whose value <= points
    public const LEVELS = [
        1 => 0, 2 => 15, 3 => 75, 4 => 250, 5 => 500,
        6 => 1500, 7 => 5000, 8 => 15000, 9 => 50000, 10 => 100000,
    ];

    public const POINTS_PLACE = 15;

    public const POINTS_PHOTO = 5;

    public const POINTS_DESCRIPTION = 5;   // description >= DESCRIPTION_MIN chars

    public const DESCRIPTION_MIN = 200;
    // saves are 1 point each (saves_count is added verbatim)

    /** @return array<int, array{points: int, level: int}> keyed by user id; ids with no approved places are omitted */
    public function forUsers(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }
        // description rides along so the 200-char bonus is counted in PHP (mb_strlen),
        // which sidesteps the sqlite/mysql LENGTH-vs-CHAR_LENGTH split
        $places = Place::where('status', 'approved')
            ->whereIn('user_id', $userIds)
            ->get(['id', 'user_id', 'saves_count', 'description']);
        $photoCounts = PlacePhoto::whereIn('place_id', $places->pluck('id'))
            ->selectRaw('place_id, count(*) as c')
            ->groupBy('place_id')
            ->pluck('c', 'place_id');

        $out = [];
        foreach ($places as $p) {
            $points = self::POINTS_PLACE
              + self::POINTS_PHOTO * (int) ($photoCounts[$p->id] ?? 0)
              + (mb_strlen($p->description) >= self::DESCRIPTION_MIN ? self::POINTS_DESCRIPTION : 0)
              + (int) $p->saves_count;
            $out[(int) $p->user_id] = ($out[(int) $p->user_id] ?? 0) + $points;
        }

        return array_map(fn ($points) => ['points' => $points, 'level' => $this->levelFor($points)], $out);
    }

    // 5-minute staleness accepted, same contract as places:guides:* (no forget hooks)
    /** @return array{points: int, level: int} */
    public function forUser(int $userId): array
    {
        return Cache::remember("places:guide-points:{$userId}", 300, function () use ($userId) {
            return $this->forUsers([$userId])[$userId] ?? ['points' => 0, 'level' => 1];
        });
    }

    public function levelFor(int $points): int
    {
        $level = 1;
        foreach (self::LEVELS as $l => $required) {
            if ($points >= $required) {
                $level = $l;
            }
        }

        return $level;
    }
}
