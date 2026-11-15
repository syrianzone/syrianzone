<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class GoogleAccountResolver
{
    public function resolve(string $email, ?string $googleId, ?string $name, ?string $avatar): User
    {
        return DB::transaction(function () use ($email, $googleId, $name, $avatar): User {
            // firstOrCreate handles a concurrent unique-email insertion. Its
            // defaults apply only to creation, never to an existing account.
            $resolved = User::withTrashed()->lockForUpdate()->firstOrCreate(['email' => $email], function () use ($email, $googleId, $name, $avatar): array {
                $configuredAdmin = config('app.superadmin_email');

                return [
                    'name' => $name ?: explode('@', $email)[0],
                    'google_id' => $googleId,
                    'avatar_url' => $avatar,
                    'password' => bcrypt(str()->random(16)),
                    'role' => is_string($configuredAdmin) && $configuredAdmin !== '' && $email === $configuredAdmin ? 'superadmin' : 'user',
                ];
            });

            // Nothing from the first model is copied back. Read current role,
            // password, name and avatar from the canonical row under its lock.
            $user = User::withTrashed()->whereKey($resolved->getKey())->where('email', $email)->lockForUpdate()->firstOrFail();
            if ($user->trashed()) {
                $user->restore();
            }
            if ($googleId !== null) {
                $user->google_id = $googleId;
            }
            if ($user->password === null) {
                $user->password = bcrypt(str()->random(16));
            }
            if ($avatar !== null && ! $this->hasCustomAvatar($user)) {
                $user->avatar_url = $avatar;
            }
            $user->save();

            return $user->refreshForUpdate();
        }, 3);
    }

    private function hasCustomAvatar(User $user): bool
    {
        $path = parse_url($user->avatar_url ?? '', PHP_URL_PATH);

        return is_string($path) && str_contains($path, "/avatars/{$user->id}/");
    }
}
