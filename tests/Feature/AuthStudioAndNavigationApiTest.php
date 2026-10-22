<?php

use App\Models\Route as TransitRoute;
use App\Models\RouteDraft;
use App\Models\User;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

function seedTestCityForStudio(string $id = 'damascus'): void
{
    if (DB::table('cities')->where('id', $id)->exists()) {
        return;
    }

    $geometry = function (array $shape) {
        $json = json_encode($shape, JSON_THROW_ON_ERROR);
        if (DB::connection()->getDriverName() === 'sqlite') {
            return $json;
        }
        $quoted = DB::connection()->getPdo()->quote($json);

        return DB::raw("ST_GeomFromGeoJSON({$quoted})");
    };

    DB::table('cities')->insert([
        'id' => $id,
        'name_ar' => 'دمشق',
        'name_en' => 'Damascus',
        'center' => $geometry(['type' => 'Point', 'coordinates' => [36.29, 33.51]]),
        'bounds' => $geometry([
            'type' => 'Polygon',
            'coordinates' => [[[36.1, 33.4], [36.5, 33.4], [36.5, 33.6], [36.1, 33.6], [36.1, 33.4]]],
        ]),
        'zoom' => 12,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

test('POST /api/v1/auth/google/token exchanges a valid Google id_token or access_token into the shared user pool', function () {
    Config::set('services.google.client_id', 'web-client-id.apps.googleusercontent.com');
    Config::set('services.google.allowed_client_ids', [
        'web-client-id.apps.googleusercontent.com',
        'ios-client-id.apps.googleusercontent.com',
    ]);

    // Pre-existing web user with the same email: must reuse the exact same User row
    $existingWebUser = User::factory()->create([
        'email' => 'shared@syrian.zone',
        'name' => 'Old Name',
        'avatar_url' => 'https://cdn.syrian.zone/avatars/1/custom.webp',
    ]);

    Http::fake([
        'https://oauth2.googleapis.com/tokeninfo?id_token=valid-id-token' => Http::response([
            'aud' => 'ios-client-id.apps.googleusercontent.com',
            'sub' => 'google-sub-123',
            'email' => 'shared@syrian.zone',
            'email_verified' => 'true',
            'name' => 'Cross Platform User',
            'picture' => 'https://lh3.googleusercontent.com/a/google-pic',
        ], 200),
        'https://www.googleapis.com/oauth2/v3/userinfo' => Http::response([
            'sub' => 'google-sub-123',
            'email' => 'shared@syrian.zone',
            'email_verified' => true,
            'name' => 'Cross Platform User',
            'picture' => 'https://lh3.googleusercontent.com/a/google-pic',
        ], 200),
        'https://oauth2.googleapis.com/tokeninfo?access_token=valid-access-token' => Http::response([
            'aud' => 'web-client-id.apps.googleusercontent.com',
            'azp' => 'web-client-id.apps.googleusercontent.com',
        ], 200),
    ]);

    // 1. Exchange via id_token
    $idTokenResp = $this->postJson('/api/v1/auth/google/token', [
        'id_token' => 'valid-id-token',
        'device_name' => 'Flutter iOS',
    ])->assertOk();

    $token1 = $idTokenResp->json('token');
    expect($token1)->toBeString()->not->toBeEmpty()
        ->and($idTokenResp->json('token_type'))->toBe('Bearer')
        ->and($idTokenResp->json('user.id'))->toBe($existingWebUser->id)
        ->and($idTokenResp->json('user.email'))->toBe('shared@syrian.zone')
        // Custom R2 avatar is preserved rather than overwritten by Google picture
        ->and($idTokenResp->json('user.avatar_url'))->toBe('https://cdn.syrian.zone/avatars/1/custom.webp')
        ->and(User::count())->toBe(1);

    // 2. Exchange via access_token on alias /api/v1/auth/google
    $accessTokenResp = $this->postJson('/api/v1/auth/google', [
        'access_token' => 'valid-access-token',
        'device_name' => 'Flutter Android',
    ])->assertOk();

    $token2 = $accessTokenResp->json('token');
    expect($token2)->toBeString()->not->toBeEmpty()
        ->and($accessTokenResp->json('user.id'))->toBe($existingWebUser->id)
        ->and(User::count())->toBe(1);

    // 3. Authenticate with Bearer token against /api/v1/auth/user and /api/v1/user
    $this->withHeader('Authorization', 'Bearer '.$token1)
        ->getJson('/api/v1/auth/user')
        ->assertOk()
        ->assertJsonPath('id', $existingWebUser->id);

    $this->withHeader('Authorization', 'Bearer '.$token1)
        ->getJson('/api/v1/user')
        ->assertOk()
        ->assertJsonPath('id', $existingWebUser->id);

    // 4. Mobile token has ['mobile'] ability, so it cannot be used as an MCP agent token
    $this->withHeader('Authorization', 'Bearer '.$token1)
        ->postJson('/mcp/admin', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'])
        ->assertForbidden();

    // 5. Logout current device revokes only token1
    $this->withHeader('Authorization', 'Bearer '.$token1)
        ->postJson('/api/v1/auth/logout')
        ->assertOk()
        ->assertJsonPath('ok', true);

    expect($existingWebUser->tokens()->count())->toBe(1);

    // 6. Logout all devices revokes remaining mobile tokens
    $this->withHeader('Authorization', 'Bearer '.$token2)
        ->postJson('/api/v1/auth/logout-devices')
        ->assertOk()
        ->assertJsonPath('ok', true);

    expect($existingWebUser->tokens()->count())->toBe(0);
});

test('POST /api/v1/auth/google/token rejects banned users and mismatched client audiences', function () {
    Config::set('services.google.allowed_client_ids', ['web-client-id.apps.googleusercontent.com']);

    User::factory()->create([
        'email' => 'banned@syrian.zone',
        'is_banned' => true,
    ]);

    Http::fake([
        'https://oauth2.googleapis.com/tokeninfo?id_token=banned-token' => Http::response([
            'aud' => 'web-client-id.apps.googleusercontent.com',
            'sub' => 'google-banned',
            'email' => 'banned@syrian.zone',
            'email_verified' => 'true',
            'name' => 'Banned User',
        ], 200),
        'https://oauth2.googleapis.com/tokeninfo?id_token=wrong-aud-token' => Http::response([
            'aud' => 'other-app.apps.googleusercontent.com',
            'sub' => 'google-other',
            'email' => 'someone@syrian.zone',
            'email_verified' => 'true',
        ], 200),
    ]);

    $this->postJson('/api/v1/auth/google/token', ['id_token' => 'banned-token'])
        ->assertForbidden();

    $this->postJson('/api/v1/auth/google/token', ['id_token' => 'wrong-aud-token'])
        ->assertStatus(401);
});

test('GET /api/v1/transit/studio/routes lists authenticated user drafts and studio edit hides linked live route until approved', function () {
    seedTestCityForStudio('damascus');

    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $mobileToken = $user->createToken('Flutter Test', ['mobile'])->plainTextToken;

    $liveRoute = TransitRoute::create([
        'id' => 'route-mazzeh-1',
        'city_id' => 'damascus',
        'user_id' => $user->id,
        'name_ar' => 'خط المزة - البرامكة',
        'name_en' => 'Mazzeh - Baramkeh',
        'mode' => 'bus',
        'color' => '#10B981',
        'status' => 'published',
    ]);

    RouteDraft::create([
        'user_id' => $otherUser->id,
        'city_id' => 'damascus',
        'name_ar' => 'مسودة مستخدم آخر',
        'geojson' => [
            'type' => 'FeatureCollection',
            'features' => [[
                'type' => 'Feature',
                'geometry' => ['type' => 'LineString', 'coordinates' => [[36.28, 33.50], [36.30, 33.52]]],
                'properties' => [],
            ]],
        ],
        'stops' => [],
        'status' => 'pending_review',
    ]);

    // Submit an edit draft for $liveRoute using Bearer token via canonical /api/v1/transit/studio/routes
    $createResp = $this->withHeader('Authorization', 'Bearer '.$mobileToken)
        ->postJson('/api/v1/transit/studio/routes', [
            'city_id' => 'damascus',
            'route_id' => $liveRoute->id,
            'name_ar' => 'خط المزة - البرامكة (محدث)',
            'name_en' => 'Mazzeh - Baramkeh Updated',
            'mode' => 'bus',
            'color' => '#10B981',
            'geojson' => [
                'type' => 'FeatureCollection',
                'features' => [[
                    'type' => 'Feature',
                    'geometry' => ['type' => 'LineString', 'coordinates' => [[36.28, 33.50], [36.31, 33.53]]],
                    'properties' => [],
                ]],
            ],
            'stops' => [
                ['name_ar' => 'المزة', 'lat' => 33.50, 'lng' => 36.28],
                ['name_ar' => 'البرامكة', 'lat' => 33.53, 'lng' => 36.31],
            ],
        ])
        ->assertCreated();

    $draftId = $createResp->json('id');
    expect($draftId)->not->toBeEmpty();

    // Live route is immediately hidden (status = disapproved) until approved
    expect($liveRoute->fresh()->status)->toBe('disapproved');

    // GET /api/v1/transit/studio/routes returns only $user's drafts
    $listResp = $this->withHeader('Authorization', 'Bearer '.$mobileToken)
        ->getJson('/api/v1/transit/studio/routes')
        ->assertOk();

    expect($listResp->json('drafts'))->toHaveCount(1)
        ->and($listResp->json('drafts.0.id'))->toBe($draftId)
        ->and($listResp->json('drafts.0.route_id'))->toBe($liveRoute->id)
        ->and($listResp->json('drafts.0.city.id'))->toBe('damascus')
        ->and($listResp->json('drafts.0.linked_route.id'))->toBe($liveRoute->id);

    // Legacy alias /api/v1/studio/routes returns identical payload
    $legacyListResp = $this->withHeader('Authorization', 'Bearer '.$mobileToken)
        ->getJson('/api/v1/studio/routes')
        ->assertOk();

    expect($legacyListResp->json('drafts'))->toHaveCount(1)
        ->and($legacyListResp->json('drafts.0.id'))->toBe($draftId);
});

test('GET /api/v1/navigation and superadmin PUT /api/v1/admin/navigation manage the single-source-of-truth navigation catalog', function () {
    // 1. Default public navigation catalog returns enabled items with cross-platform schema
    $publicResp = $this->getJson('/api/v1/navigation')
        ->assertOk();

    $items = $publicResp->json('items');
    $defaultTotalCount = count($items);
    expect($items)->toBeArray()->not->toBeEmpty();

    $transitItem = collect($items)->firstWhere('id', 'transit');
    expect($transitItem)->not->toBeNull()
        ->and($transitItem)->toHaveKeys([
            'id', 'title', 'subtitle', 'iconUrl', 'type', 'target', 'subCategories',
            'surfaces', 'enabled', 'text', 'href', 'iconKey', 'showOnHome', 'showInNavbar',
        ])
        ->and($transitItem['title'])->toBe('ترانزيت')
        ->and($transitItem['type'])->toBe('native')
        ->and($transitItem['target'])->toBe('transit_map');

    // 2. Non-superadmin cannot update navigation catalog
    $normalUser = User::factory()->create(['role' => 'user']);
    $this->actingAs($normalUser)
        ->putJson('/api/v1/admin/navigation', ['items' => []])
        ->assertForbidden();

    // 3. Superadmin can update items, hide a built-in item, and add subCategories
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $this->actingAs($superadmin)
        ->get('/admin/navigation')
        ->assertOk();

    $customItems = [
        [
            'id' => 'transit',
            'title' => 'ترانزيت سوريا',
            'subtitle' => 'شبكة وخطوط النقل العام',
            'href' => '/transit',
            'iconKey' => 'transit',
            'iconUrl' => 'https://syrian.zone/assets/icons/transit.svg',
            'type' => 'native',
            'target' => 'transit_map',
            'enabled' => true,
            'surfaces' => ['home', 'navbar', 'mobile_menubar'],
            'subCategories' => [
                [
                    'id' => 'transit_studio',
                    'title' => 'استوديو المسارات',
                    'subtitle' => 'أضف أو عدل مساراً',
                    'href' => '/transit/studio',
                    'type' => 'native',
                    'target' => 'transit_studio',
                ],
            ],
        ],
        [
            'id' => 'compass',
            'title' => 'البوصلة السورية',
            'subtitle' => 'قيد التجربة',
            'href' => '/compass',
            'iconKey' => 'compass',
            'type' => 'native',
            'target' => 'compass',
            'enabled' => false,
            'surfaces' => ['home'],
            'subCategories' => [],
        ],
    ];

    $this->actingAs($superadmin)
        ->putJson('/api/v1/admin/navigation', ['items' => $customItems])
        ->assertOk();

    // 4. Public GET /api/v1/navigation excludes enabled=false by default (compass is hidden)
    $filteredPublic = $this->getJson('/api/v1/navigation')->assertOk()->json('items');
    expect($filteredPublic)->toHaveCount($defaultTotalCount - 1)
        ->and($filteredPublic[0]['id'])->toBe('transit')
        ->and($filteredPublic[0]['title'])->toBe('ترانزيت سوريا')
        ->and($filteredPublic[0]['subCategories'])->toHaveCount(1)
        ->and($filteredPublic[0]['subCategories'][0]['id'])->toBe('transit_studio')
        ->and(collect($filteredPublic)->firstWhere('id', 'compass'))->toBeNull();

    // 5. ?include_disabled=1 returns all items including hidden ones
    $allPublic = $this->getJson('/api/v1/navigation?include_disabled=1')->assertOk()->json('items');
    expect($allPublic)->toHaveCount($defaultTotalCount)
        ->and(collect($allPublic)->firstWhere('id', 'compass')['enabled'])->toBeFalse();

    // 6. Resetting with empty array restores default catalog (compass enabled again)
    $this->actingAs($superadmin)
        ->putJson('/api/v1/admin/navigation', ['items' => []])
        ->assertOk();

    expect($this->getJson('/api/v1/navigation')->json('items'))->toHaveCount($defaultTotalCount);
});
