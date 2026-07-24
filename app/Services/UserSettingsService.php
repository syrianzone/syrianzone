<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

final class UserSettingsService
{
    /**
     * @param  array<string, mixed>  $changes
     * @return array<string, mixed>
     */
    public function merge(User $actor, array $changes): array
    {
        return DB::transaction(function () use ($actor, $changes): array {
            $user = User::query()
                ->whereKey($actor->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $user->settings = array_replace($user->settings ?? [], $changes);
            $user->save();

            return $user->settings ?? [];
        }, 3);
    }
}
