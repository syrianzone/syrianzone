<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class UserAccessService
{
    public function revoke(User $user): void
    {
        $user->tokens()->delete();

        $sessionTable = (string) config('session.table', 'sessions');
        if ($sessionTable !== '' && Schema::hasTable($sessionTable)) {
            DB::table($sessionTable)->where('user_id', $user->getKey())->delete();
        }
    }
}
