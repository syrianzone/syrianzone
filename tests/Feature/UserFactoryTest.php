<?php

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;

/*
|--------------------------------------------------------------------------
| UserFactory defaults
|--------------------------------------------------------------------------
|
| The factory used to default to role 'admin'. Because User::hasPermission()
| short-circuited on that role, every bare `User::factory()->create()` in the
| suite was a full-capability account — so any test asserting that a
| capability-gated route admits its caller passed for the wrong reason, and
| would have passed with the capability check deleted outright.
|
| The default is now an ordinary community member holding nothing, so an
| under-specified test fails instead of quietly asserting nothing. That surfaced
| fourteen tests which had been passing vacuously, in CandidateTest,
| CandidateGroupTest and PollTest.
|
| The point is not that the factory cannot make staff. It is that staff is named
| at the call site.
|
*/

it('mints an ordinary member of the community by default', function () {
    $user = User::factory()->create();

    expect($user->role)->toBe('user')
        ->and($user->permissions)->toBe([])
        ->and($user->effectivePermissions())->toBe([])
        ->and($user->isSuperAdmin())->toBeFalse();
});

it('offers explicit states for the accounts tests actually need', function () {
    expect(User::factory()->superadmin()->create()->isSuperAdmin())->toBeTrue()
        ->and(User::factory()->module('transit')->create()->effectivePermissions())
        ->toBe(PermissionCatalogue::forModule('transit'))
        ->and(User::factory()->withPermissions(['polls.edit'])->create()->hasPermission('polls.edit'))
        ->toBeTrue()
        // module() replaces the list rather than adding to it, so two calls
        // compose explicitly instead of accumulating.
        // States are applied in order and the last one wins, so composing them
        // does NOT union. Pinned because the natural reading of
        // module()->withPermissions() is that both apply, and it does not.
        ->and(User::factory()->module('polls')->withPermissions(['phonebook.toggle'])->create()
            ->effectivePermissions())
        ->toBe(['phonebook.toggle']);
});
