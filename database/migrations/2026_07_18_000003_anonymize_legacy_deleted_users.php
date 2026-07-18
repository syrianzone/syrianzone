<?php

use App\Models\User;
use App\Services\MediaCleanupService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'deleted_at')) {
            return;
        }

        $delegateId = DB::table('users')
            ->whereNull('deleted_at')
            ->where('role', 'superadmin')
            ->where('is_banned', false)
            ->orderBy('id')
            ->value('id');
        $cleanup = app(MediaCleanupService::class);

        DB::table('users')
            ->whereNotNull('deleted_at')
            ->orderBy('id')
            ->chunkById(100, function ($users) use ($cleanup, $delegateId): void {
                foreach ($users as $user) {
                    $this->anonymize($user, $delegateId, $cleanup);
                }
            });
    }

    public function down(): void
    {
        // Deleted identity data can't be reconstructed safely.
    }

    private function anonymize(
        object $user,
        ?int $delegateId,
        MediaCleanupService $cleanup,
    ): void {
        $email = "deleted+{$user->id}@deleted.invalid";

        DB::transaction(function () use ($cleanup, $delegateId, $email, $user): void {
            if (Schema::hasTable('personal_access_tokens')) {
                DB::table('personal_access_tokens')
                    ->where('tokenable_type', User::class)
                    ->where('tokenable_id', $user->id)
                    ->delete();
            }
            if (Schema::hasTable('sessions')) {
                DB::table('sessions')->where('user_id', $user->id)->delete();
            }
            if (Schema::hasTable('password_reset_tokens')) {
                DB::table('password_reset_tokens')->where('email', $user->email)->delete();
            }
            if ($delegateId !== null && Schema::hasColumn('polls', 'user_id')) {
                DB::table('polls')->where('user_id', $user->id)->update(['user_id' => $delegateId]);
            }
            if ($delegateId !== null && Schema::hasColumn('routes', 'user_id')) {
                DB::table('routes')->where('user_id', $user->id)->update(['user_id' => $delegateId]);
            }

            $cleanup->queueDirectory(
                "avatars/{$user->id}",
                $user->avatar_disk ?: (string) config('filesystems.media_disk'),
            );
            DB::table('users')->where('id', $user->id)->whereNotNull('deleted_at')->update([
                'avatar_disk' => null,
                'avatar_path' => null,
                'avatar_url' => null,
                'email' => $email,
                'email_verified_at' => null,
                'google_id' => null,
                'is_banned' => true,
                'name' => "Deleted user {$user->id}",
                'password' => $user->email === $email ? $user->password : Hash::make(Str::random(64)),
                'remember_token' => null,
                'role' => 'user',
            ]);
        });
    }
};
