<?php

use App\Http\Middleware\AutoLoginDevUser;
use App\Models\User;

test('web directory administration requires the permission for each action', function (
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
})->with([
    'SyOfficial create rejects edit permission' => [
        'POST',
        '/api/v1/admin/syofficial/categories',
        'syofficial.edit',
    ],
    'SyOfficial edit rejects create permission' => [
        'PUT',
        '/api/v1/admin/syofficial/categories/missing',
        'syofficial.create',
    ],
    'SyOfficial delete rejects edit permission' => [
        'DELETE',
        '/api/v1/admin/syofficial/categories/missing',
        'syofficial.edit',
    ],
    'SyOfficial reorder rejects create permission' => [
        'POST',
        '/api/v1/admin/syofficial/reorder/categories',
        'syofficial.create',
    ],
    'GovApps create rejects edit permission' => [
        'POST',
        '/api/v1/admin/govapps',
        'govapps.edit',
    ],
    'GovApps edit rejects create permission' => [
        'POST',
        '/api/v1/admin/govapps/missing',
        'govapps.create',
    ],
    'GovApps delete rejects edit permission' => [
        'DELETE',
        '/api/v1/admin/govapps/missing',
        'govapps.edit',
    ],
    'GovApps reorder rejects create permission' => [
        'POST',
        '/api/v1/admin/govapps/reorder',
        'govapps.create',
    ],
    'Phonebook create rejects edit permission' => [
        'POST',
        '/api/v1/admin/phonebook/categories',
        'phonebook.edit',
    ],
    'Phonebook edit rejects create permission' => [
        'PUT',
        '/api/v1/admin/phonebook/categories/missing',
        'phonebook.create',
    ],
    'Phonebook toggle rejects edit permission' => [
        'POST',
        '/api/v1/admin/phonebook/entries/missing/toggle',
        'phonebook.edit',
    ],
    'Phonebook delete rejects edit permission' => [
        'DELETE',
        '/api/v1/admin/phonebook/categories/missing',
        'phonebook.edit',
    ],
    'Phonebook reorder rejects create permission' => [
        'POST',
        '/api/v1/admin/phonebook/reorder/categories',
        'phonebook.create',
    ],
]);

test('web directory administration accepts the permission for its action', function (
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
})->with([
    'SyOfficial create' => [
        'POST',
        '/api/v1/admin/syofficial/categories',
        'syofficial.create',
        422,
    ],
    'SyOfficial edit' => [
        'PUT',
        '/api/v1/admin/syofficial/categories/missing',
        'syofficial.edit',
        404,
    ],
    'SyOfficial delete' => [
        'DELETE',
        '/api/v1/admin/syofficial/categories/missing',
        'syofficial.delete',
        404,
    ],
    'SyOfficial reorder' => [
        'POST',
        '/api/v1/admin/syofficial/reorder/categories',
        'syofficial.reorder',
        422,
    ],
    'GovApps create' => [
        'POST',
        '/api/v1/admin/govapps',
        'govapps.create',
        422,
    ],
    'GovApps edit' => [
        'POST',
        '/api/v1/admin/govapps/missing',
        'govapps.edit',
        404,
    ],
    'GovApps delete' => [
        'DELETE',
        '/api/v1/admin/govapps/missing',
        'govapps.delete',
        404,
    ],
    'GovApps reorder' => [
        'POST',
        '/api/v1/admin/govapps/reorder',
        'govapps.reorder',
        422,
    ],
    'Phonebook create' => [
        'POST',
        '/api/v1/admin/phonebook/categories',
        'phonebook.create',
        422,
    ],
    'Phonebook edit' => [
        'PUT',
        '/api/v1/admin/phonebook/categories/missing',
        'phonebook.edit',
        404,
    ],
    'Phonebook toggle' => [
        'POST',
        '/api/v1/admin/phonebook/entries/missing/toggle',
        'phonebook.toggle',
        404,
    ],
    'Phonebook delete' => [
        'DELETE',
        '/api/v1/admin/phonebook/categories/missing',
        'phonebook.delete',
        404,
    ],
    'Phonebook reorder' => [
        'POST',
        '/api/v1/admin/phonebook/reorder/categories',
        'phonebook.reorder',
        422,
    ],
]);
