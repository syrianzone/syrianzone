<?php

use App\Models\OfficialCategory;
use App\Models\User;
use App\Support\Agents\TokenIssuer;

/*
|--------------------------------------------------------------------------
| Discovery for the directory and transit tools
|--------------------------------------------------------------------------
|
| Everything else asserts handle() directly. This drives the real JSON-RPC
| surface instead, because that is the only place two things get checked that a
| direct call cannot reach: shouldRegister() deciding what an agent is offered,
| and the write tools being reachable at all — they live in the ToolSearch
| catalogue, so an agent finds them with search_tools and runs them with
| execute_tools, two hops that only exist over HTTP.
|
| The syofficial half of this file mirrors the production token exactly: all
| five syofficial.* abilities and nothing else.
|
*/

test('a syofficial-only token is offered the directory read tools and nothing else', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => [
        'syofficial.create', 'syofficial.edit', 'syofficial.toggle',
        'syofficial.delete', 'syofficial.reorder',
    ]]);

    $plain = app(TokenIssuer::class)->issue($staff, 'directory', [
        'syofficial.create', 'syofficial.edit', 'syofficial.toggle',
        'syofficial.delete', 'syofficial.reorder',
    ])['token']->plainTextToken;

    $names = mcpToolNames($plain);

    expect($names)->toContain(
        'list-syofficial-categories',
        'list-syofficial-entities',
        'search_tools',
        'execute_tools',
    )
        // Nothing from the other modules may leak into a syofficial token.
        ->and($names)->not->toContain('list-places', 'list-gov-apps', 'list-transit-drafts');
});

test('a govapps-only token sees the apps listing but no syofficial or transit tools', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => ['govapps.create', 'govapps.delete']]);

    $plain = app(TokenIssuer::class)->issue($staff, 'govapps', ['govapps.create', 'govapps.delete'])['token']->plainTextToken;

    $names = mcpToolNames($plain);

    expect($names)->toContain('list-gov-apps')
        ->and($names)->not->toContain('list-syofficial-categories', 'list-transit-drafts', 'list-places');
});

test('a transit review token sees the transit listings', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => ['transit.review_drafts']]);

    $plain = app(TokenIssuer::class)->issue($staff, 'transit', ['transit.review_drafts'])['token']->plainTextToken;

    expect(mcpToolNames($plain))->toContain(
        'list-transit-drafts',
        'get-transit-draft-geometry',
        'list-transit-routes',
        'list-transit-route-history',
    );
});

test('a token with no capability in a module is offered none of its tools', function () {
    // Permissions on the user but not on the token: the ceiling wins, so the
    // agent never even learns the tools exist.
    $staff = User::factory()->create([
        'role' => 'user',
        'permissions' => [
            'syofficial.create', 'govapps.create', 'transit.review_drafts', 'places.review',
        ],
    ]);

    $plain = app(TokenIssuer::class)->issue($staff, 'narrow', ['places.review'])['token']->plainTextToken;

    expect(mcpToolNames($plain))->toContain('list-places')
        ->and(mcpToolNames($plain))->not->toContain(
            'list-syofficial-categories',
            'list-gov-apps',
            'list-transit-drafts',
        );
});

test('the directory write tools are reachable through the search catalogue', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => [
        'syofficial.create', 'syofficial.edit', 'syofficial.toggle',
        'syofficial.delete', 'syofficial.reorder',
    ]]);

    $plain = app(TokenIssuer::class)->issue($staff, 'directory', [
        'syofficial.create', 'syofficial.edit', 'syofficial.toggle',
        'syofficial.delete', 'syofficial.reorder',
    ])['token']->plainTextToken;

    $found = mcpSearchToolNames($plain, 'create a new syofficial category');

    expect($found)->toContain('create-syofficial-category');
});

test('a write tool outside the token abilities is not offered by the catalogue', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => [
        'syofficial.create', 'syofficial.delete',
    ]]);

    // Create only, on the token.
    $plain = app(TokenIssuer::class)->issue($staff, 'create-only', ['syofficial.create'])['token']->plainTextToken;

    expect(mcpSearchToolNames($plain, 'create a new syofficial category'))
        ->toContain('create-syofficial-category')
        ->and(mcpSearchToolNames($plain, 'permanently delete a syofficial category'))
        ->not->toContain('delete-syofficial-category');
});

test('a directory write round-trips over the real jsonrpc surface', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => ['syofficial.create', 'syofficial.reorder']]);

    $plain = app(TokenIssuer::class)->issue($staff, 'directory', [
        'syofficial.create', 'syofficial.reorder',
    ])['token']->plainTextToken;

    // The catalogue's write tool, invoked through execute_tools.
    $created = mcpExecuteTool($plain, 'create-syofficial-category', [
        'id' => 'ministries',
        'label_ar' => 'الوزارات',
        'label_en' => 'Ministries',
    ]);

    expect($created['ok'] ?? false)->toBeTrue()
        ->and($created['results'][0]['isError'] ?? true)->toBeFalse()
        ->and(OfficialCategory::where('id', 'ministries')->exists())->toBeTrue();

    // And the read tool sees it, still scoped to this token.
    $listed = mcpCall($plain, [
        'method' => 'tools/call',
        'params' => ['name' => 'list-syofficial-categories', 'arguments' => []],
    ])->assertOk();

    expect($listed->json('result.structuredContent.count'))->toBe(1)
        ->and($listed->json('result.structuredContent.categories.0.id'))->toBe('ministries');
});

test('a tool call outside the token abilities is refused over the real surface', function () {
    $staff = User::factory()->create(['role' => 'user', 'permissions' => ['syofficial.create']]);
    $plain = app(TokenIssuer::class)->issue($staff, 'create-only', ['syofficial.create'])['token']->plainTextToken;

    $result = mcpExecuteTool($plain, 'delete-syofficial-category', ['id' => 'anything']);

    // The catalogue refuses to hand the tool over at all, before any domain
    // logic runs.
    expect($result['ok'] ?? true)->toBeFalse()
        ->and(json_encode($result))->toContain('not available');
});

test('a transit token cannot reach another governorate over the real surface', function () {
    seedCity('homs', ['name_ar' => 'حمص', 'name_en' => 'Homs']);
    seedCity('aleppo', ['name_ar' => 'حلب', 'name_en' => 'Aleppo']);
    transitDraft('aleppo', ['name_ar' => 'خارج النطاق']);

    $staff = User::factory()->create([
        'role' => 'user',
        'permissions' => ['transit.review_drafts', 'transit.approve'],
        'permission_scopes' => ['transit' => ['homs']],
    ]);

    $plain = app(TokenIssuer::class)->issue($staff, 'transit', [
        'transit.review_drafts', 'transit.approve',
    ])['token']->plainTextToken;

    $listed = mcpCall($plain, [
        'method' => 'tools/call',
        'params' => ['name' => 'list-transit-drafts', 'arguments' => []],
    ])->assertOk();

    expect($listed->json('result.structuredContent.count'))->toBe(0)
        ->and($listed->json('result.structuredContent.scope'))->toBe(['homs']);
});
