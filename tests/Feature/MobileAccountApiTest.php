<?php

use App\Models\Poll;
use App\Models\RouteDraft;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

function mobileAccountBearer(User $user): string
{
    return $user->createToken('mobile:account-test', ['mobile'])->plainTextToken;
}

function seedMobileAccountCity(): void
{
    DB::table('cities')->insert([
        'bounds' => json_encode([
            'coordinates' => [[[35.8, 33.3], [36.8, 33.3], [36.8, 33.7], [35.8, 33.3]]],
            'type' => 'Polygon',
        ], JSON_THROW_ON_ERROR),
        'center' => json_encode([
            'coordinates' => [36.29, 33.51],
            'type' => 'Point',
        ], JSON_THROW_ON_ERROR),
        'created_at' => now(),
        'id' => 'damascus',
        'name_ar' => 'دمشق',
        'name_en' => 'Damascus',
        'status' => 'active',
        'updated_at' => now(),
        'zoom' => 12,
    ]);
}

function mobileAccountDraft(User $user, string $status = 'pending'): RouteDraft
{
    return RouteDraft::create([
        'city_id' => 'damascus',
        'geojson' => [
            'features' => [[
                'geometry' => [
                    'coordinates' => [[36.2, 33.4], [36.3, 33.5]],
                    'type' => 'LineString',
                ],
                'properties' => [],
                'type' => 'Feature',
            ]],
            'type' => 'FeatureCollection',
        ],
        'name_ar' => 'خط تجريبي',
        'status' => $status,
        'user_id' => $user->id,
    ]);
}

test('mobile account endpoints require a mobile bearer token', function () {
    $user = User::factory()->create();
    $wildcard = $user->createToken('web-token', ['*'])->plainTextToken;

    $this->getJson('/api/mobile/account')->assertUnauthorized();
    $this->withToken($wildcard)->getJson('/api/mobile/account')->assertUnauthorized();
});

test('mobile account returns a bounded user and personal draft workspace', function () {
    $user = User::factory()->create([
        'permissions' => ['places.review'],
        'role' => 'admin',
        'settings' => ['showWeather' => false],
    ]);
    Poll::factory()->create(['user_id' => $user->id]);

    $this->withToken(mobileAccountBearer($user))->getJson('/api/mobile/account')
        ->assertOk()
        ->assertJsonPath('data.user.id', $user->id)
        ->assertJsonPath('data.user.permissions.0', 'places.review')
        ->assertJsonPath('data.user.settings.showWeather', false)
        ->assertJsonPath('data.role', 'admin')
        ->assertJsonCount(0, 'data.myDrafts')
        ->assertJsonCount(1, 'data.polls')
        ->assertJsonMissingPath('data.user.password');
});

test('mobile account settings merge bounded preference documents', function () {
    $user = User::factory()->create([
        'settings' => [
            'showWeather' => true,
            'language' => 'ar',
        ],
    ]);
    $token = mobileAccountBearer($user);
    DB::table('users')->where('id', $user->id)->update([
        'settings' => json_encode([
            'showWeather' => true,
            'language' => 'ar',
            'serverRevision' => 3,
        ], JSON_THROW_ON_ERROR),
    ]);

    $this->withToken($token)->patchJson('/api/mobile/account/settings', [
        'settings' => [
            'showWeather' => false,
            'customLinks' => [],
        ],
    ])->assertOk()
        ->assertJsonPath('data.settings.showWeather', false)
        ->assertJsonPath('data.settings.serverRevision', 3)
        ->assertJsonPath('data.settings.language', 'ar');

    expect($user->fresh()->settings)->toMatchArray([
        'showWeather' => false,
        'customLinks' => [],
        'language' => 'ar',
        'serverRevision' => 3,
    ]);

    $this->withToken($token)->patchJson('/api/mobile/account/settings', [
        'settings' => ['value' => str_repeat('x', 70_000)],
    ])->assertUnprocessable();
});

test('mobile account update validates uniqueness and returns the updated user', function () {
    User::factory()->create(['email' => 'taken@example.test']);
    $user = User::factory()->create(['email' => 'old@example.test']);
    $token = mobileAccountBearer($user);

    $this->withToken($token)->patchJson('/api/mobile/account', [
        'email' => 'taken@example.test',
        'name' => 'Updated Name',
    ])->assertUnprocessable()->assertJsonValidationErrors('email');

    $this->withToken($token)->patchJson('/api/mobile/account', [
        'email' => 'new@example.test',
        'name' => 'Updated Name',
    ])->assertOk()
        ->assertJsonPath('data.user.email', 'new@example.test')
        ->assertJsonPath('data.user.name', 'Updated Name');
});

test('mobile account owner can upload and replace a profile avatar', function () {
    Storage::fake('public');
    $user = User::factory()->create(['role' => 'user']);
    $token = mobileAccountBearer($user);

    $first = $this->withToken($token)->postJson('/api/mobile/account/avatar', [
        'avatar' => UploadedFile::fake()->image('first.jpg', 640, 480),
    ])->assertOk()
        ->assertJsonPath('data.user.id', $user->id);

    $firstPath = Storage::disk('public')->files("avatars/{$user->id}")[0];
    expect($first->json('data.user.avatar_url'))
        ->toBe(Storage::disk('public')->url($firstPath));

    $this->withToken($token)->postJson('/api/mobile/account/avatar', [
        'avatar' => UploadedFile::fake()->image('second.png', 300, 300),
    ])->assertOk();

    Storage::disk('public')->assertMissing($firstPath);
    expect(Storage::disk('public')->files("avatars/{$user->id}"))->toHaveCount(1);
});

test('mobile avatar upload rejects wildcard tokens and invalid files', function () {
    Storage::fake('public');
    $user = User::factory()->create(['role' => 'user']);
    $wildcard = $user->createToken('web-token', ['*'])->plainTextToken;

    $this->withToken($wildcard)->postJson('/api/mobile/account/avatar', [
        'avatar' => UploadedFile::fake()->image('avatar.jpg', 300, 300),
    ])->assertUnauthorized();

    $this->withToken(mobileAccountBearer($user))->postJson('/api/mobile/account/avatar', [
        'avatar' => UploadedFile::fake()->create('avatar.pdf', 100, 'application/pdf'),
    ])->assertUnprocessable()->assertJsonValidationErrors('avatar');
});

test('account owners can withdraw only their own pending transit drafts', function () {
    seedMobileAccountCity();
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $pending = mobileAccountDraft($owner);
    $approved = mobileAccountDraft($owner, 'approved');
    $foreign = mobileAccountDraft($other);
    $token = mobileAccountBearer($owner);

    $this->withToken($token)
        ->deleteJson("/api/mobile/account/transit-drafts/{$foreign->id}")
        ->assertNotFound();
    $this->withToken($token)
        ->deleteJson("/api/mobile/account/transit-drafts/{$approved->id}")
        ->assertConflict()
        ->assertExactJson([
            'code' => 'draft_not_pending',
            'message' => 'لا يمكن سحب اقتراح تمت مراجعته.',
        ]);
    $this->withToken($token)
        ->deleteJson("/api/mobile/account/transit-drafts/{$pending->id}")
        ->assertOk()
        ->assertExactJson(['data' => ['deleted' => true]]);

    $this->assertDatabaseMissing('route_drafts', ['id' => $pending->id]);
    $this->assertDatabaseHas('route_drafts', ['id' => $approved->id]);
    $this->assertDatabaseHas('route_drafts', ['id' => $foreign->id]);
});

test('mobile account deletion delegates polls and revokes every token', function () {
    $owner = User::factory()->create([
        'avatar_url' => 'https://accounts.example.test/private-avatar.png',
        'email' => 'private-profile@example.test',
        'google_id' => 'google-private-subject',
        'name' => 'Private Profile Name',
    ]);
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $poll = Poll::factory()->create(['user_id' => $owner->id]);
    $token = mobileAccountBearer($owner);
    $owner->createToken('mobile:second-device', ['mobile']);

    $this->withToken($token)->deleteJson('/api/mobile/account')
        ->assertOk()
        ->assertExactJson(['data' => ['deleted' => true]]);

    $deletedOwner = $owner->fresh();

    expect($deletedOwner->deleted_at)->not->toBeNull()
        ->and($deletedOwner->avatar_url)->toBeNull()
        ->and($deletedOwner->email)->not->toBe('private-profile@example.test')
        ->and($deletedOwner->email)->toEndWith('@deleted.invalid')
        ->and($deletedOwner->google_id)->toBeNull()
        ->and($deletedOwner->is_banned)->toBeTrue()
        ->and($deletedOwner->name)->not->toBe('Private Profile Name')
        ->and($owner->tokens()->count())->toBe(0)
        ->and($poll->fresh()->user_id)->toBe($superadmin->id);
});

test('mobile account deletion keeps the final active superadmin', function () {
    $first = User::factory()->create(['role' => 'superadmin']);
    $last = User::factory()->create(['role' => 'superadmin']);
    $poll = Poll::factory()->create(['user_id' => $first->id]);
    $firstToken = mobileAccountBearer($first);
    $lastToken = mobileAccountBearer($last);

    $this->withToken($firstToken)->deleteJson('/api/mobile/account')
        ->assertOk()
        ->assertExactJson(['data' => ['deleted' => true]]);

    $this->withToken($lastToken)->deleteJson('/api/mobile/account')
        ->assertConflict()
        ->assertExactJson([
            'code' => 'last_superadmin',
            'message' => 'لا يمكن حذف آخر مشرف عام.',
        ]);

    expect($first->fresh()->deleted_at)->not->toBeNull()
        ->and($last->fresh()->deleted_at)->toBeNull()
        ->and($poll->fresh()->user_id)->toBe($last->id);
});
