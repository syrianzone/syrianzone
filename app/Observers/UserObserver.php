<?php

namespace App\Observers;

use App\Models\User;
use App\Services\UserAccessService;

class UserObserver
{
    public function __construct(
        private readonly UserAccessService $access,
    ) {}

    public function updated(User $user): void
    {
        if ($user->wasChanged('is_banned') && $user->is_banned) {
            $this->access->revoke($user);
        }
    }
}
