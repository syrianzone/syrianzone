<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;

test('user settings require an active authenticated account', function () {
    $this->postJson('/api/user/settings', ['settings' => ['showClock' => false]])
        ->assertUnauthorized();

    $banned = User::factory()->create(['is_banned' => true]);
    $this->actingAs($banned)
        ->postJson('/api/user/settings', ['settings' => ['showClock' => false]])
        ->assertForbidden();
});

test('user settings merge bounded preference updates', function () {
    $user = User::factory()->create([
        'settings' => ['language' => 'ar', 'showClock' => true],
    ]);

    $this->actingAs($user);
    DB::table('users')->where('id', $user->id)->update([
        'settings' => json_encode([
            'language' => 'ar',
            'serverRevision' => 2,
            'showClock' => true,
        ], JSON_THROW_ON_ERROR),
    ]);

    $this->postJson('/api/user/settings', [
        'settings' => ['showClock' => false, 'customLinks' => []],
    ])
        ->assertOk()
        ->assertJsonPath('settings.language', 'ar')
        ->assertJsonPath('settings.serverRevision', 2)
        ->assertJsonPath('settings.showClock', false);

    expect($user->fresh()->settings)->toMatchArray([
        'language' => 'ar',
        'serverRevision' => 2,
        'showClock' => false,
        'customLinks' => [],
    ]);
});

test('user settings reject malformed and oversized documents', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/user/settings', ['settings' => 'invalid'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('settings');

    $this->actingAs($user)
        ->postJson('/api/user/settings', [
            'settings' => ['value' => str_repeat('x', 70_000)],
        ])
        ->assertUnprocessable();
});
