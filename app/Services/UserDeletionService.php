<?php

namespace App\Services;

use App\Models\Poll;
use App\Models\Route;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UserDeletionService
{
    public function deleteAccountAndTransferOwnership(User $user): bool
    {
        return DB::transaction(function () use ($user): bool {
            $superadmins = User::query()
                ->where('role', 'superadmin')
                ->where('is_banned', false)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            $account = User::query()->lockForUpdate()->findOrFail($user->id);
            $delegate = $superadmins->firstWhere('id', '!=', $account->id);

            if ($account->isSuperAdmin() && ! $delegate) {
                return false;
            }

            if ($delegate) {
                Poll::where('user_id', $account->id)->update(['user_id' => $delegate->id]);
                Route::where('user_id', $account->id)->update(['user_id' => $delegate->id]);
            }

            $this->anonymizeAndDelete($account);

            return true;
        });
    }

    public function anonymizeAndDelete(User $user): void
    {
        $user->tokens()->delete();
        $user->forceFill([
            'avatar_url' => null,
            'email' => sprintf(
                'deleted+%d+%s@deleted.invalid',
                $user->id,
                Str::lower(Str::random(24)),
            ),
            'email_verified_at' => null,
            'google_id' => null,
            'is_banned' => true,
            'name' => sprintf('Deleted user %d', $user->id),
            'password' => Str::random(64),
            'remember_token' => null,
            'role' => 'user',
        ])->save();
        $user->delete();
    }
}
