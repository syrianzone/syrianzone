<?php

use App\Http\Middleware\FirstPartyAdminTransport;
use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;

function nativeUserAdminAs(User $user, array $abilities = ['mobile']): array
{
    Auth::forgetGuards();

    return ['Authorization' => 'Bearer '.$user->createToken('Local native user test', $abilities)->plainTextToken];
}

function nativeUserForm(User $user, string $version): array
{
    return ['name' => $user->name, 'email' => $user->email, 'role' => $user->role, 'is_banned' => (bool) $user->is_banned,
        'permissions' => array_values(array_intersect($user->permissions ?? [], PermissionCatalogue::all())),
        'transit_scope' => $user->permission_scopes['transit'] ?? [], 'version' => $version];
}

test('native user administration requires a non-banned first-party superadmin', function () {
    $this->getJson('/api/v1/admin/users/options')->assertUnauthorized();
    foreach ([
        [User::factory()->withPermissions(PermissionCatalogue::all())->create(), ['mobile']],
        [User::factory()->create(['role' => 'superadmin', 'is_banned' => true]), ['mobile']],
        [User::factory()->superadmin()->create(), ['users.ban']],
        [User::factory()->superadmin()->create(), ['*']],
    ] as [$user, $abilities]) {
        $this->withHeaders(nativeUserAdminAs($user, $abilities))->getJson('/api/v1/admin/users/options')->assertForbidden();
    }
    $superadmin = User::factory()->superadmin()->create();
    $this->withHeaders(nativeUserAdminAs($superadmin))->getJson('/api/v1/admin/users/options')->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('can_manage_users', true)
        ->assertJsonPath('actor_id', $superadmin->id)->assertJsonPath('roles.0.value', 'superadmin');
    foreach (['GET', 'POST', 'PUT', 'DELETE'] as $method) {
        $path = in_array($method, ['GET', 'POST'], true) ? '/api/v1/admin/users' : '/api/v1/admin/users/1';
        $middleware = Route::getRoutes()->match(Request::create($path, $method))->gatherMiddleware();
        expect($middleware)->toContain('api', 'auth:sanctum', FirstPartyAdminTransport::class, 'superadmin')->not->toContain('web');
    }
});

test('user listing searches sorts paginates and filters trashed rows without disclosing credentials', function () {
    $admin = User::factory()->superadmin()->create();
    $alpha = User::factory()->create(['name' => 'Alpha search', 'email' => 'alpha@example.test', 'google_id' => 'private-google-id']);
    $zulu = User::factory()->create(['name' => 'Zulu search']);
    $zulu->delete();
    $this->withHeaders(nativeUserAdminAs($admin))->getJson('/api/v1/admin/users?q=search&sort=name&direction=asc&per_page=1')
        ->assertOk()->assertJsonPath('data.0.id', $alpha->id)->assertJsonPath('total', 1)
        ->assertJsonMissingPath('data.0.password')->assertJsonMissingPath('data.0.google_id')->assertJsonMissingPath('data.0.remember_token');
    $this->getJson('/api/v1/admin/users?q=search&trashed=with&sort=name&direction=desc&per_page=1')
        ->assertOk()->assertJsonPath('data.0.id', $zulu->id)->assertJsonPath('last_page', 2);
    $this->getJson('/api/v1/admin/users?trashed=only')->assertOk()->assertJsonPath('data.0.id', $zulu->id);
    $this->getJson('/api/v1/admin/users?sort=password')->assertUnprocessable();
});

test('native user creation hashes a required password and sends no notifications', function () {
    Mail::fake();
    Notification::fake();
    $this->withHeaders(nativeUserAdminAs(User::factory()->superadmin()->create()))
        ->postJson('/api/v1/admin/users', ['name' => 'اسم محلي', 'email' => 'native-local@example.test', 'password' => 'local-password-only', 'role' => 'user', 'is_banned' => false, 'permissions' => ['phonebook.create'], 'transit_scope' => []])
        ->assertCreated()->assertJsonPath('success', true)->assertJsonPath('user.permissions.0', 'phonebook.create')
        ->assertJsonMissingPath('user.password');
    $created = User::where('email', 'native-local@example.test')->firstOrFail();
    expect(Hash::check('local-password-only', $created->password))->toBeTrue();
    Mail::assertNothingSent();
    Notification::assertNothingSent();
    $this->postJson('/api/v1/admin/users', ['name' => 'Missing', 'email' => 'missing@example.test', 'role' => 'user', 'is_banned' => false, 'permissions' => [], 'transit_scope' => []])
        ->assertUnprocessable()->assertJsonValidationErrors('password');
});

test('submitted bcrypt-looking passwords are literal passwords rather than accepted stored hashes', function (string $operation) {
    $literal = Hash::make('different underlying password');
    $this->withHeaders(nativeUserAdminAs(User::factory()->superadmin()->create()));
    if ($operation === 'create') {
        $response = $this->postJson('/api/v1/admin/users', [
            'name' => 'Hash literal', 'email' => 'hash-literal@example.test', 'password' => $literal,
            'role' => 'user', 'is_banned' => false, 'permissions' => [], 'transit_scope' => [],
        ])->assertCreated();
        $target = User::findOrFail($response->json('user.id'));
    } else {
        $target = User::factory()->create();
        $version = $this->getJson('/api/v1/admin/users/'.$target->id)->assertOk()->json('user.version');
        $this->putJson('/api/v1/admin/users/'.$target->id, [...nativeUserForm($target, $version), 'password' => $literal])->assertOk();
        $target->refresh();
    }
    expect(Hash::check($literal, $target->password))->toBeTrue()
        ->and(Hash::check('different underlying password', $target->password))->toBeFalse();
})->with(['create', 'update']);

test('native edits preserve unknown permissions and other scopes while replacing the known form values', function () {
    DB::table('cities')->insert(['id' => 'native-city', 'name_ar' => 'مدينة اختبار', 'name_en' => 'Local city', 'zoom' => 12, 'center' => '{}', 'bounds' => '{}']);
    $target = User::factory()->create(['permissions' => ['*', 'future.permission', 'polls.create'], 'permission_scopes' => ['transit' => ['native-city'], 'places' => ['future-place']]]);
    $password = $target->password;
    $this->withHeaders(nativeUserAdminAs(User::factory()->superadmin()->create()));
    $version = $this->getJson('/api/v1/admin/users/'.$target->id)->assertOk()->json('user.version');
    $this->putJson('/api/v1/admin/users/'.$target->id, [...nativeUserForm($target, $version), 'permissions' => ['transit.approve'], 'transit_scope' => [], 'password' => ''])
        ->assertOk()->assertJsonPath('success', true)->assertJsonPath('user.transit_scope', null);
    $target->refresh();
    expect($target->password)->toBe($password)->and($target->permissions)->toEqual(['transit.approve', '*', 'future.permission'])
        ->and($target->permission_scopes)->toBe(['places' => ['future-place']]);
    $version = $this->getJson('/api/v1/admin/users/'.$target->id)->json('user.version');
    $this->putJson('/api/v1/admin/users/'.$target->id, [...nativeUserForm($target, $version), 'password' => '   '])->assertOk();
    expect($target->fresh()->password)->toBe($password);
    $version = $this->getJson('/api/v1/admin/users/'.$target->id)->json('user.version');
    $this->putJson('/api/v1/admin/users/'.$target->id, [...nativeUserForm($target, $version), 'password' => 'replacement-local'])
        ->assertOk();
    expect(Hash::check('replacement-local', $target->fresh()->password))->toBeTrue();
});

test('stale user edits do not overwrite live permissions or accept client-injected unknown capabilities', function () {
    $target = User::factory()->create();
    $this->withHeaders(nativeUserAdminAs(User::factory()->superadmin()->create()));
    $version = $this->getJson('/api/v1/admin/users/'.$target->id)->json('user.version');
    $target->update(['permissions' => ['transit.reject']]);
    $this->putJson('/api/v1/admin/users/'.$target->id, [...nativeUserForm($target, $version), 'permissions' => ['polls.create']])->assertConflict();
    expect($target->fresh()->permissions)->toBe(['transit.reject']);
    $version = $this->getJson('/api/v1/admin/users/'.$target->id)->json('user.version');
    foreach (['*', 'mobile', 'future.new'] as $permission) {
        $this->putJson('/api/v1/admin/users/'.$target->id, [...nativeUserForm($target, $version), 'permissions' => [$permission]])->assertUnprocessable()->assertJsonValidationErrors('permissions.0');
    }
});

test('native user edits preserve the source ban refusal and permitted self-demotion', function () {
    $admin = User::factory()->superadmin()->create();
    $this->withHeaders(nativeUserAdminAs($admin));
    $version = $this->getJson('/api/v1/admin/users/'.$admin->id)->json('user.version');
    $this->putJson('/api/v1/admin/users/'.$admin->id, [...nativeUserForm($admin, $version), 'is_banned' => true])->assertForbidden();
    expect($admin->fresh()->is_banned)->toBeFalse();
    $this->putJson('/api/v1/admin/users/'.$admin->id, [...nativeUserForm($admin, $version), 'role' => 'user'])->assertOk();
    expect($admin->fresh()->role)->toBe('user');
    Auth::forgetGuards();
    $this->getJson('/api/v1/admin/users/options')->assertForbidden();
});

test('native self-deletion keeps the source action and invalidates the next authenticated read', function () {
    $admin = User::factory()->superadmin()->create();
    $this->withHeaders(nativeUserAdminAs($admin));
    $version = $this->getJson('/api/v1/admin/users/'.$admin->id)->json('user.version');
    $this->deleteJson('/api/v1/admin/users/'.$admin->id, ['version' => $version])->assertOk()->assertJsonPath('success', true);
    expect(User::find($admin->id))->toBeNull();
    Auth::forgetGuards();
    $this->getJson('/api/v1/admin/users/options')->assertUnauthorized();
});

test('soft deletion restoration and permanent deletion preserve source state boundaries', function () {
    $target = User::factory()->create();
    $this->withHeaders(nativeUserAdminAs(User::factory()->superadmin()->create()));
    $version = $this->getJson('/api/v1/admin/users/'.$target->id)->json('user.version');
    $this->deleteJson('/api/v1/admin/users/'.$target->id.'/force', ['version' => $version])->assertUnprocessable();
    $this->deleteJson('/api/v1/admin/users/'.$target->id, ['version' => $version])->assertOk()->assertJsonPath('success', true);
    expect(User::find($target->id))->toBeNull();
    $version = $this->getJson('/api/v1/admin/users/'.$target->id)->json('user.version');
    $this->postJson('/api/v1/admin/users/'.$target->id.'/restore', ['version' => $version])->assertOk()->assertJsonPath('user.deleted_at', null);
    expect(User::find($target->id))->not->toBeNull();
    $version = $this->getJson('/api/v1/admin/users/'.$target->id)->json('user.version');
    $this->deleteJson('/api/v1/admin/users/'.$target->id, ['version' => $version])->assertOk();
    $version = $this->getJson('/api/v1/admin/users/'.$target->id)->json('user.version');
    $this->deleteJson('/api/v1/admin/users/'.$target->id.'/force', ['version' => $version])->assertOk()->assertJsonPath('ids.0', $target->id);
    expect(User::withTrashed()->find($target->id))->toBeNull();
});

test('bulk destructive actions validate the whole selection before changing any account', function () {
    $admin = User::factory()->superadmin()->create();
    $target = User::factory()->create();
    $this->withHeaders(nativeUserAdminAs($admin));
    $versions = [];
    foreach ([$admin, $target] as $user) {
        $versions[$user->id] = $this->getJson('/api/v1/admin/users/'.$user->id)->json('user.version');
    }
    $this->postJson('/api/v1/admin/users/bulk', ['action' => 'delete', 'ids' => [$target->id, 999999], 'versions' => [$target->id => $versions[$target->id], 999999 => str_repeat('a', 64)]])->assertNotFound();
    expect($target->fresh()->deleted_at)->toBeNull();
    foreach (['delete', 'restore', 'force-delete'] as $action) {
        $version = $this->getJson('/api/v1/admin/users/'.$target->id)->json('user.version');
        $this->postJson('/api/v1/admin/users/bulk', ['action' => $action, 'ids' => [$target->id], 'versions' => [$target->id => $version]])
            ->assertOk()->assertJsonPath('success', true)->assertJsonPath('ids.0', $target->id);
        if ($action === 'restore') {
            $version = $this->getJson('/api/v1/admin/users/'.$target->id)->json('user.version');
            $this->deleteJson('/api/v1/admin/users/'.$target->id, ['version' => $version])->assertOk();
        }
    }
});
