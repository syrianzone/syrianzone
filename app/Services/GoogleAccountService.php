<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Socialite\Contracts\User as SocialiteUser;

class GoogleAccountService
{
    public function resolve(SocialiteUser $googleUser): ?User
    {
        $email = $this->email($googleUser->getEmail());
        $googleId = $this->requiredString($googleUser->getId());

        if (! $email || ! $googleId) {
            return null;
        }

        try {
            return DB::transaction(
                fn (): ?User => $this->resolveLocked($googleUser, $email, $googleId),
                3,
            );
        } catch (UniqueConstraintViolationException) {
            return null;
        }
    }

    private function resolveLocked(SocialiteUser $googleUser, string $email, string $googleId): ?User
    {
        $matches = User::withTrashed()
            ->where(function ($query) use ($email, $googleId): void {
                $query->where('google_id', $googleId)->orWhere('email', $email);
            })
            ->lockForUpdate()
            ->get();

        if ($matches->contains(fn (User $user): bool => $user->trashed())) {
            return null;
        }

        $subjectUser = $matches->first(
            fn (User $user): bool => hash_equals((string) $user->google_id, $googleId),
        );
        $emailUser = $matches->first(
            fn (User $user): bool => hash_equals($this->email($user->email) ?? '', $email),
        );

        if ($subjectUser && $emailUser && ! $subjectUser->is($emailUser)) {
            return null;
        }

        if ($emailUser?->google_id && ! hash_equals((string) $emailUser->google_id, $googleId)) {
            return null;
        }

        $user = $subjectUser ?: $emailUser;

        if ($user?->is_banned) {
            return null;
        }

        $superadminEmail = $this->email(config('app.superadmin_email'));
        $isSuperadmin = $superadminEmail !== null && hash_equals($superadminEmail, $email);
        $isNewUser = $user === null;
        $user ??= new User;
        $attributes = [
            'email' => $email,
            'google_id' => $googleId,
            'role' => $isSuperadmin ? 'superadmin' : ($user->role ?? 'user'),
        ];

        if ($isNewUser) {
            $attributes['name'] = $this->requiredString($googleUser->getName()) ?? $email;
        }

        if (! $this->hasCustomAvatar($user)) {
            $attributes['avatar_disk'] = null;
            $attributes['avatar_path'] = null;
            $attributes['avatar_url'] = $this->requiredString($googleUser->getAvatar());
        }

        $user->forceFill($attributes);

        if (! $user->exists) {
            $user->password = Hash::make(Str::random(32));
        }

        $user->save();

        return $user;
    }

    private function hasCustomAvatar(User $user): bool
    {
        return $user->exists
            && is_string($user->avatar_disk)
            && $user->avatar_disk !== ''
            && is_string($user->avatar_path)
            && $user->avatar_path !== '';
    }

    private function email(mixed $value): ?string
    {
        $email = $this->requiredString($value);

        if (! $email) {
            return null;
        }

        $email = mb_strtolower($email);

        return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }

    private function requiredString(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }
}
