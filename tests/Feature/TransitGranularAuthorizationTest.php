<?php

use App\Http\Middleware\AutoLoginDevUser;
use App\Models\User;

function mobileTransitPermissionToken(User $user): string
{
    return $user->createToken('mobile:transit-permission-test', ['mobile'])->plainTextToken;
}

test('web transit administration requires the permission for each action', function (
    string $method,
    string $uri,
    string $heldPermission,
) {
    $user = User::factory()->create([
        'permissions' => [$heldPermission],
        'role' => 'user',
    ]);

    $this->withoutMiddleware(AutoLoginDevUser::class)
        ->actingAs($user)
        ->json($method, $uri)
        ->assertForbidden();
})->with('web transit permission boundaries');

test('verified mobile transit administration requires the permission for each action', function (
    string $method,
    string $uri,
    string $heldPermission,
) {
    $user = User::factory()->create([
        'permissions' => [$heldPermission],
        'role' => 'user',
    ]);

    $this->withToken(mobileTransitPermissionToken($user))
        ->json($method, $uri)
        ->assertForbidden();
})->with('mobile transit permission boundaries');

test('web transit administration accepts the permission for its action', function (
    string $method,
    string $uri,
    string $permission,
    int $expectedStatus,
) {
    $user = User::factory()->create([
        'permissions' => [$permission],
        'role' => 'user',
    ]);

    $this->withoutMiddleware(AutoLoginDevUser::class)
        ->actingAs($user)
        ->json($method, $uri)
        ->assertStatus($expectedStatus);
})->with('web transit exact permissions');

test('verified mobile transit administration accepts the permission for its action', function (
    string $method,
    string $uri,
    string $permission,
    int $expectedStatus,
) {
    $user = User::factory()->create([
        'permissions' => [$permission],
        'role' => 'user',
    ]);

    $this->withToken(mobileTransitPermissionToken($user))
        ->json($method, $uri)
        ->assertStatus($expectedStatus);
})->with('mobile transit exact permissions');

test('full transit roles retain access to transit administration', function (string $role) {
    $user = User::factory()->create([
        'permissions' => [],
        'role' => $role,
    ]);

    $this->withoutMiddleware(AutoLoginDevUser::class)
        ->actingAs($user)
        ->getJson('/api/v1/admin/routes/logs')
        ->assertOk();

    $this->withToken(mobileTransitPermissionToken($user))
        ->getJson('/api/mobile/admin/routes/logs')
        ->assertOk();
})->with(['admin', 'superadmin', 'transit_admin']);

dataset('web transit permission boundaries', [
    'review drafts rejects edit permission' => [
        'GET',
        '/api/v1/admin/route-drafts',
        'transit.edit_routes',
    ],
    'approve rejects review permission' => [
        'POST',
        '/api/v1/admin/route-drafts/1/approve',
        'transit.review_drafts',
    ],
    'reject rejects review permission' => [
        'POST',
        '/api/v1/admin/route-drafts/1/reject',
        'transit.review_drafts',
    ],
    'edit routes rejects review permission' => [
        'GET',
        '/api/v1/admin/routes',
        'transit.review_drafts',
    ],
    'move routes rejects review permission' => [
        'POST',
        '/api/v1/admin/routes/missing/move',
        'transit.review_drafts',
    ],
    'combine routes rejects review permission' => [
        'POST',
        '/api/v1/admin/routes/combine',
        'transit.review_drafts',
    ],
    'split routes rejects review permission' => [
        'POST',
        '/api/v1/admin/routes/split',
        'transit.review_drafts',
    ],
    'view logs rejects review permission' => [
        'GET',
        '/api/v1/admin/routes/logs',
        'transit.review_drafts',
    ],
]);

dataset('mobile transit permission boundaries', [
    'review drafts rejects edit permission' => [
        'GET',
        '/api/mobile/admin/transit-drafts',
        'transit.edit_routes',
    ],
    'approve rejects review permission' => [
        'POST',
        '/api/mobile/admin/transit-drafts/1/approve',
        'transit.review_drafts',
    ],
    'reject rejects review permission' => [
        'POST',
        '/api/mobile/admin/transit-drafts/1/reject',
        'transit.review_drafts',
    ],
    'edit routes rejects review permission' => [
        'GET',
        '/api/mobile/admin/routes',
        'transit.review_drafts',
    ],
    'move routes rejects review permission' => [
        'POST',
        '/api/mobile/admin/routes/missing/move',
        'transit.review_drafts',
    ],
    'combine routes rejects review permission' => [
        'POST',
        '/api/mobile/admin/routes/combine',
        'transit.review_drafts',
    ],
    'split routes rejects review permission' => [
        'POST',
        '/api/mobile/admin/routes/split',
        'transit.review_drafts',
    ],
    'view logs rejects review permission' => [
        'GET',
        '/api/mobile/admin/routes/logs',
        'transit.review_drafts',
    ],
]);

dataset('web transit exact permissions', [
    'review drafts' => [
        'GET',
        '/api/v1/admin/route-drafts',
        'transit.review_drafts',
        200,
    ],
    'approve' => [
        'POST',
        '/api/v1/admin/route-drafts/1/approve',
        'transit.approve',
        404,
    ],
    'reject' => [
        'POST',
        '/api/v1/admin/route-drafts/1/reject',
        'transit.reject',
        404,
    ],
    'edit routes' => [
        'GET',
        '/api/v1/admin/routes',
        'transit.edit_routes',
        200,
    ],
    'move routes' => [
        'POST',
        '/api/v1/admin/routes/missing/move',
        'transit.move_routes',
        422,
    ],
    'combine routes' => [
        'POST',
        '/api/v1/admin/routes/combine',
        'transit.combine_routes',
        422,
    ],
    'split routes' => [
        'POST',
        '/api/v1/admin/routes/split',
        'transit.split_routes',
        422,
    ],
    'view logs' => [
        'GET',
        '/api/v1/admin/routes/logs',
        'transit.view_logs',
        200,
    ],
]);

dataset('mobile transit exact permissions', [
    'review drafts' => [
        'GET',
        '/api/mobile/admin/transit-drafts',
        'transit.review_drafts',
        200,
    ],
    'approve' => [
        'POST',
        '/api/mobile/admin/transit-drafts/1/approve',
        'transit.approve',
        404,
    ],
    'reject' => [
        'POST',
        '/api/mobile/admin/transit-drafts/1/reject',
        'transit.reject',
        404,
    ],
    'edit routes' => [
        'GET',
        '/api/mobile/admin/routes',
        'transit.edit_routes',
        200,
    ],
    'move routes' => [
        'POST',
        '/api/mobile/admin/routes/missing/move',
        'transit.move_routes',
        422,
    ],
    'combine routes' => [
        'POST',
        '/api/mobile/admin/routes/combine',
        'transit.combine_routes',
        422,
    ],
    'split routes' => [
        'POST',
        '/api/mobile/admin/routes/split',
        'transit.split_routes',
        422,
    ],
    'view logs' => [
        'GET',
        '/api/mobile/admin/routes/logs',
        'transit.view_logs',
        200,
    ],
]);
