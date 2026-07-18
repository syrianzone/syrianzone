<?php

use App\Filament\Resources\UserResource\Pages\EditUser;
use App\Filament\Resources\UserResource\Pages\ListUsers;
use App\Models\Poll;
use App\Models\User;
use Filament\Facades\Filament;
use Livewire\Livewire;

beforeEach(function () {
    Filament::setCurrentPanel(Filament::getPanel('superadmin'));
});

test('filament deletion anonymizes a non-superadmin and transfers ownership', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $target = User::factory()->create([
        'avatar_url' => 'https://accounts.example.test/private-filament.png',
        'email' => 'private-filament@example.test',
        'google_id' => 'private-filament-subject',
        'name' => 'Private Filament User',
        'role' => 'admin',
    ]);
    $target->createToken('mobile:filament-device', ['mobile']);
    $poll = Poll::factory()->create(['user_id' => $target->id]);

    $this->actingAs($superadmin);
    Livewire::test(ListUsers::class)
        ->callTableAction('deleteAccount', $target)
        ->assertHasNoTableActionErrors();

    $deleted = User::withTrashed()->findOrFail($target->id);
    expect($deleted->deleted_at)->not->toBeNull()
        ->and($deleted->avatar_url)->toBeNull()
        ->and($deleted->email)->not->toBe('private-filament@example.test')
        ->and($deleted->email)->toEndWith('@deleted.invalid')
        ->and($deleted->google_id)->toBeNull()
        ->and($deleted->name)->not->toBe('Private Filament User')
        ->and($target->tokens()->count())->toBe(0)
        ->and($poll->fresh()->user_id)->toBe($superadmin->id);
});

test('filament exposes no direct force or bulk user deletion paths', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $target = User::factory()->create(['role' => 'admin']);
    $this->actingAs($superadmin);

    Livewire::test(ListUsers::class)
        ->assertTableActionDoesNotExist('delete')
        ->assertTableActionDoesNotExist('forceDelete')
        ->assertTableBulkActionDoesNotExist('delete')
        ->assertTableBulkActionDoesNotExist('forceDelete')
        ->assertTableActionVisible('deleteAccount', $target)
        ->assertTableActionHidden('deleteAccount', $superadmin);

    Livewire::test(EditUser::class, ['record' => $target->getRouteKey()])
        ->assertActionDoesNotExist('delete')
        ->assertActionDoesNotExist('forceDelete');
});

test('filament keeps the final active superadmin when changing account access', function (array $changes, string $field) {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $this->actingAs($superadmin);

    Livewire::test(EditUser::class, ['record' => $superadmin->getRouteKey()])
        ->fillForm($changes)
        ->call('save')
        ->assertHasFormErrors([$field]);

    expect($superadmin->fresh())
        ->role->toBe('superadmin')
        ->is_banned->toBeFalse();
})->with([
    'demotion' => [['role' => 'admin'], 'role'],
    'ban' => [['is_banned' => true], 'is_banned'],
]);

test('filament permits superadmin access changes when an active delegate remains', function (array $changes, string $role, bool $isBanned) {
    $actor = User::factory()->create(['role' => 'superadmin']);
    $target = User::factory()->create(['role' => 'superadmin']);
    $this->actingAs($actor);

    Livewire::test(EditUser::class, ['record' => $target->getRouteKey()])
        ->fillForm($changes)
        ->call('save')
        ->assertHasNoFormErrors();

    expect($target->fresh())
        ->role->toBe($role)
        ->is_banned->toBe($isBanned);
})->with([
    'demotion' => [['role' => 'admin'], 'admin', false],
    'ban' => [['is_banned' => true], 'superadmin', true],
]);
