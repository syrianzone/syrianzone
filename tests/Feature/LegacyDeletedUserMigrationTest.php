<?php

namespace Tests\Feature;

use App\Models\MediaCleanupJob;
use App\Models\Poll;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LegacyDeletedUserMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_cleans_legacy_soft_deleted_accounts_and_can_run_twice(): void
    {
        Storage::fake('public');
        $delegate = User::factory()->create(['role' => 'superadmin']);
        $legacy = User::factory()->create([
            'avatar_url' => null,
            'email' => 'legacy-private@example.test',
            'google_id' => 'legacy-google-subject',
            'is_banned' => false,
            'name' => 'Legacy Private Name',
            'role' => 'admin',
        ]);
        $avatarPath = "avatars/{$legacy->id}/legacy-private.webp";
        Storage::disk('public')->put($avatarPath, 'legacy private avatar');
        $legacy->forceFill(['avatar_url' => Storage::disk('public')->url($avatarPath)])->save();
        $tokenId = $legacy->createToken('legacy-mobile', ['mobile'])->accessToken->id;
        DB::table('sessions')->insert([
            'id' => 'legacy-session',
            'user_id' => $legacy->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Legacy Browser',
            'payload' => 'private session payload',
            'last_activity' => now()->timestamp,
        ]);
        DB::table('password_reset_tokens')->insert([
            'email' => $legacy->email,
            'token' => 'legacy-reset-token',
            'created_at' => now(),
        ]);
        $poll = Poll::factory()->create(['user_id' => $legacy->id]);
        $legacy->delete();
        $active = User::factory()->create(['email' => 'active@example.test']);

        $migration = require database_path('migrations/2026_07_18_000003_anonymize_legacy_deleted_users.php');
        $migration->up();
        $migration->up();

        $deleted = User::withTrashed()->findOrFail($legacy->id);
        $this->assertSame("deleted+{$legacy->id}@deleted.invalid", $deleted->email);
        $this->assertSame("Deleted user {$legacy->id}", $deleted->name);
        $this->assertNull($deleted->google_id);
        $this->assertNull($deleted->avatar_url);
        $this->assertNull($deleted->email_verified_at);
        $this->assertNull($deleted->remember_token);
        $this->assertSame('user', $deleted->role);
        $this->assertTrue($deleted->is_banned);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $tokenId]);
        $this->assertDatabaseMissing('sessions', ['id' => 'legacy-session']);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => 'legacy-private@example.test']);
        $this->assertSame($delegate->id, $poll->fresh()->user_id);
        $this->assertSame('active@example.test', $active->fresh()->email);
        Storage::disk('public')->assertMissing($avatarPath);
    }

    public function test_it_revokes_credentials_before_retrying_a_failed_avatar_cleanup(): void
    {
        Storage::fake('public');
        User::factory()->create(['role' => 'superadmin']);
        $legacy = User::factory()->create([
            'email' => 'legacy-retry@example.test',
            'google_id' => 'legacy-retry-subject',
            'name' => 'Legacy Retry Name',
            'role' => 'admin',
        ]);
        $avatarPath = "avatars/{$legacy->id}/legacy-retry.webp";
        $disk = Storage::disk('public');
        $disk->put($avatarPath, 'legacy retry avatar');
        $avatarUrl = $disk->url($avatarPath);
        $legacy->forceFill(['avatar_url' => $avatarUrl])->save();
        $tokenId = $legacy->createToken('legacy-retry', ['mobile'])->accessToken->id;
        DB::table('sessions')->insert([
            'id' => 'legacy-retry-session',
            'user_id' => $legacy->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Legacy Retry Browser',
            'payload' => 'private retry session',
            'last_activity' => now()->timestamp,
        ]);
        $legacy->delete();
        $failingDisk = \Mockery::mock($disk)->makePartial();
        $failingDisk->shouldReceive('deleteDirectory')->once()->andReturnFalse();
        Storage::set('public', $failingDisk);
        $migration = require database_path('migrations/2026_07_18_000003_anonymize_legacy_deleted_users.php');

        $migration->up();

        $afterFailure = User::withTrashed()->findOrFail($legacy->id);
        $this->assertSame("deleted+{$legacy->id}@deleted.invalid", $afterFailure->email);
        $this->assertNull($afterFailure->google_id);
        $this->assertNull($afterFailure->avatar_url);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $tokenId]);
        $this->assertDatabaseMissing('sessions', ['id' => 'legacy-retry-session']);
        $this->assertSame(1, MediaCleanupJob::query()->where('attempts', 1)->count());

        Storage::set('public', $disk);
        $this->travel(2)->minutes();
        $this->artisan('media:cleanup')->assertSuccessful();
        $disk->assertMissing($avatarPath);
    }
}
