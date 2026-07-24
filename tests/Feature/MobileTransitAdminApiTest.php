<?php

use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\User;
use App\Services\TransitDraftGeoJson;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route as RouteFacade;

function mobileTransitAdminGeometry(array $geometry): mixed
{
    $json = json_encode($geometry, JSON_THROW_ON_ERROR);
    if (DB::connection()->getDriverName() === 'sqlite') {
        return $json;
    }

    $quoted = DB::connection()->getPdo()->quote($json);

    return DB::raw("ST_GeomFromGeoJSON({$quoted})");
}

function seedMobileTransitAdminCity(): void
{
    DB::table('cities')->insert([
        'id' => 'damascus',
        'name_ar' => 'دمشق',
        'name_en' => 'Damascus',
        'center' => mobileTransitAdminGeometry([
            'type' => 'Point',
            'coordinates' => [36.29, 33.51],
        ]),
        'bounds' => mobileTransitAdminGeometry([
            'type' => 'Polygon',
            'coordinates' => [[[35.8, 33.3], [36.8, 33.3], [36.8, 33.7], [35.8, 33.3]]],
        ]),
        'zoom' => 12,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

function mobileTransitAdminUser(string $role): array
{
    $user = User::factory()->create(['role' => $role, 'is_banned' => false]);
    $token = $user->createToken('mobile:test', ['mobile'], now()->addHour());

    return [$user, $token->plainTextToken];
}

function seedMobileTransitDraft(?User $user = null): RouteDraft
{
    return RouteDraft::create([
        'user_id' => $user?->id,
        'city_id' => 'damascus',
        'name_ar' => 'خط تجريبي',
        'name_en' => 'Test route',
        'price' => 3_000,
        'notes' => 'مسار للاختبار',
        'geojson' => [
            'type' => 'FeatureCollection',
            'features' => [
                [
                    'type' => 'Feature',
                    'properties' => [],
                    'geometry' => [
                        'type' => 'LineString',
                        'coordinates' => [[36.2, 33.4], [36.3, 33.5]],
                    ],
                ],
                [
                    'type' => 'Feature',
                    'properties' => ['nameAr' => 'البرامكة'],
                    'geometry' => ['type' => 'Point', 'coordinates' => [36.2, 33.4]],
                ],
                [
                    'type' => 'Feature',
                    'properties' => ['nameAr' => 'ساحة الأمويين'],
                    'geometry' => ['type' => 'Point', 'coordinates' => [36.3, 33.5]],
                ],
            ],
        ],
        'status' => 'pending',
    ]);
}

beforeEach(function () {
    seedMobileTransitAdminCity();
});

test('transit draft review requires a valid mobile bearer and reviewer role', function () {
    $this->getJson('/api/mobile/admin/transit-drafts')->assertUnauthorized();

    [, $token] = mobileTransitAdminUser('user');
    $this->withToken($token)
        ->getJson('/api/mobile/admin/transit-drafts')
        ->assertForbidden();
});

test('published route administration requires mobile provenance and reviewer role', function () {
    $this->getJson('/api/mobile/admin/routes')->assertUnauthorized();

    $reviewer = User::factory()->create(['role' => 'transit_admin']);
    $wildcard = $reviewer->createToken('browser-token');
    $this->withToken($wildcard->plainTextToken)
        ->getJson('/api/mobile/admin/routes')
        ->assertUnauthorized();

    [, $contributorToken] = mobileTransitAdminUser('user');
    $this->withToken($contributorToken)
        ->getJson('/api/mobile/admin/routes')
        ->assertForbidden();
});

test('mobile route administration exposes the current main route contracts', function () {
    $uris = collect(RouteFacade::getRoutes())->map(fn ($route): string => $route->uri());

    expect($uris)->toContain(
        'api/mobile/admin/routes',
        'api/mobile/admin/routes/logs',
        'api/mobile/admin/routes/combine',
        'api/mobile/admin/routes/split',
        'api/mobile/admin/routes/{id}/status',
        'api/mobile/admin/routes/{id}',
        'api/mobile/admin/routes/{id}/move',
        'api/mobile/admin/routes/{id}/stops',
        'api/mobile/admin/routes/{id}/geojson',
    );
});

test('a mobile transit reviewer can list routes and change publication status', function () {
    [, $token] = mobileTransitAdminUser('transit_admin');
    $route = Route::create([
        'id' => 'route-damascus-mobile-admin',
        'city_id' => 'damascus',
        'name_ar' => 'خط إدارة الجوال',
        'status' => 'published',
    ]);

    $this->withToken($token)
        ->getJson('/api/mobile/admin/routes')
        ->assertOk()
        ->assertJsonPath('0.id', $route->id);

    $this->withToken($token)
        ->postJson("/api/mobile/admin/routes/{$route->id}/status", ['status' => 'hidden'])
        ->assertOk()
        ->assertJsonPath('route.status', 'hidden');

    $this->assertDatabaseHas('routes', ['id' => $route->id, 'status' => 'hidden']);
    $this->withToken($token)
        ->getJson('/api/mobile/admin/routes/logs')
        ->assertOk()
        ->assertJsonPath('0.route_id', $route->id);
});

test('transit draft mutation routes require numeric draft identifiers', function () {
    [, $token] = mobileTransitAdminUser('transit_admin');

    $this->withToken($token)
        ->postJson('/api/mobile/admin/transit-drafts/not-a-number/approve')
        ->assertNotFound();
});

test('transit reviewers can list and reject a route draft', function (string $role) {
    [$user, $token] = mobileTransitAdminUser($role);
    $draft = seedMobileTransitDraft($user);

    $this->withToken($token)
        ->getJson('/api/mobile/admin/transit-drafts')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.id', $draft->id)
        ->assertJsonPath('0.user.id', $user->id)
        ->assertJsonPath('0.user.name', $user->name)
        ->assertJsonPath('0.user.is_banned', false)
        ->assertJsonPath('0.city.name_ar', 'دمشق');

    $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$draft->id}/reject", [
            'reason' => 'المسار بحاجة إلى تعديل',
        ])
        ->assertOk()
        ->assertExactJson(['message' => 'Draft rejected']);

    $this->assertDatabaseHas('route_drafts', [
        'id' => $draft->id,
        'status' => 'rejected',
        'rejection_reason' => 'المسار بحاجة إلى تعديل',
    ]);
})->with(['admin', 'transit_admin', 'superadmin']);

test('a reviewer can publish draft geometry and ordered stops transactionally', function () {
    [$user, $token] = mobileTransitAdminUser('transit_admin');
    $draft = seedMobileTransitDraft($user);

    $response = $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$draft->id}/approve")
        ->assertOk()
        ->assertJsonPath('message', 'Draft approved')
        ->assertJsonPath('route.city_id', 'damascus');

    $routeId = $response->json('route.id');
    expect($routeId)->toBeString();
    $this->assertDatabaseHas('route_drafts', ['id' => $draft->id, 'status' => 'approved']);
    $this->assertDatabaseHas('route_geometries', ['route_id' => $routeId]);
    $this->assertDatabaseCount('stops', 2);
    $this->assertDatabaseHas('route_stop', ['route_id' => $routeId, 'order' => 1]);
    $this->assertDatabaseHas('route_stop', ['route_id' => $routeId, 'order' => 2]);

    $orderedStops = DB::table('route_stop')
        ->join('stops', 'stops.id', '=', 'route_stop.stop_id')
        ->where('route_stop.route_id', $routeId)
        ->orderBy('route_stop.order')
        ->pluck('stops.name_ar')
        ->all();
    expect($orderedStops)->toBe(['البرامكة', 'ساحة الأمويين']);
});

test('draft review permits only one terminal transition and one published route', function () {
    [$user, $token] = mobileTransitAdminUser('transit_admin');
    $approved = seedMobileTransitDraft($user);
    $rejected = seedMobileTransitDraft($user);

    $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$approved->id}/approve")
        ->assertOk();
    $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$approved->id}/approve")
        ->assertStatus(400)
        ->assertJsonPath('message', 'Draft is already approved');
    $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$approved->id}/reject")
        ->assertStatus(400)
        ->assertJsonPath('message', 'Draft is already approved');

    $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$rejected->id}/reject")
        ->assertOk();
    $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$rejected->id}/approve")
        ->assertStatus(400)
        ->assertJsonPath('message', 'Draft is already rejected');

    $this->assertDatabaseCount('routes', 1);
    $this->assertDatabaseHas('route_drafts', [
        'id' => $approved->id,
        'status' => 'approved',
    ]);
    $this->assertDatabaseHas('route_drafts', [
        'id' => $rejected->id,
        'status' => 'rejected',
    ]);
});

test('studio submissions remain anonymous or bind a verified mobile bearer', function () {
    $payload = [
        'city_id' => 'damascus',
        'name_ar' => 'خط من المجتمع',
        'geojson' => [
            'type' => 'FeatureCollection',
            'features' => [[
                'type' => 'Feature',
                'properties' => [],
                'geometry' => [
                    'type' => 'LineString',
                    'coordinates' => [[36.2, 33.4], [36.3, 33.5]],
                ],
            ], [
                'type' => 'Feature',
                'properties' => ['nameAr' => 'البرامكة'],
                'geometry' => [
                    'type' => 'Point',
                    'coordinates' => [36.25, 33.45],
                ],
            ]],
        ],
    ];

    $this->postJson('/api/v1/studio/routes', $payload)
        ->assertCreated()
        ->assertJsonPath('user_id', null)
        ->assertJsonPath('geojson.features.1.geometry.type', 'Point')
        ->assertJsonPath('geojson.features.1.properties.nameAr', 'البرامكة');

    [$user, $token] = mobileTransitAdminUser('user');
    $this->withToken($token)
        ->postJson('/api/v1/studio/routes', $payload)
        ->assertCreated()
        ->assertJsonPath('user_id', $user->id);
});

test('mobile bearers can read and update their transit drafts', function () {
    [$user, $token] = mobileTransitAdminUser('user');
    $draft = seedMobileTransitDraft($user);

    $this->getJson("/api/v1/studio/routes/{$draft->id}")->assertUnauthorized();

    $this->withToken($token)
        ->getJson("/api/v1/studio/routes/{$draft->id}")
        ->assertOk()
        ->assertJsonPath('id', $draft->id);

    $this->withToken($token)
        ->putJson("/api/v1/studio/routes/{$draft->id}", ['name_ar' => 'خط جوال معدل'])
        ->assertOk()
        ->assertJsonPath('name_ar', 'خط جوال معدل');

    $this->assertDatabaseHas('route_drafts', [
        'id' => $draft->id,
        'name_ar' => 'خط جوال معدل',
    ]);
});

test('a linked mobile draft unpublishes and then atomically updates its route on approval', function () {
    [$contributor, $contributorToken] = mobileTransitAdminUser('user');
    $route = Route::create([
        'id' => 'route-damascus-linked-mobile',
        'city_id' => 'damascus',
        'name_ar' => 'الخط القديم',
        'status' => 'published',
    ]);
    $payload = [
        'route_id' => $route->id,
        'city_id' => 'damascus',
        'name_ar' => 'الخط المعدل',
        'price' => 4_500,
        'geojson' => seedMobileTransitDraft($contributor)->geojson,
    ];

    $response = $this->withToken($contributorToken)
        ->postJson('/api/v1/studio/routes', $payload)
        ->assertCreated()
        ->assertJsonPath('route_id', $route->id);
    $draftId = $response->json('id');
    expect($route->fresh()->status)->toBe('disapproved');

    [, $reviewerToken] = mobileTransitAdminUser('transit_admin');
    $this->withToken($reviewerToken)
        ->postJson("/api/mobile/admin/transit-drafts/{$draftId}/approve")
        ->assertOk()
        ->assertJsonPath('message', 'Draft approved and route updated')
        ->assertJsonPath('route.id', $route->id);

    $route->refresh();
    expect($route->name_ar)->toBe('الخط المعدل')
        ->and($route->price_new)->toBe(4_500)
        ->and($route->status)->toBe('published');
    $this->assertDatabaseHas('route_geometries', ['route_id' => $route->id]);
    $this->assertDatabaseHas('route_drafts', ['id' => $draftId, 'status' => 'approved']);
});

test('mobile bearers can load a published route into Transit Studio', function () {
    [, $token] = mobileTransitAdminUser('user');
    $route = Route::create([
        'id' => 'route-damascus-studio-source',
        'city_id' => 'damascus',
        'name_ar' => 'خط مصدر',
        'status' => 'published',
    ]);

    $this->withToken($token)
        ->getJson("/api/v1/studio/routes/{$route->id}/from-route")
        ->assertOk()
        ->assertJsonPath('route_id', $route->id)
        ->assertJsonPath('geojson.type', 'FeatureCollection');
});

test('studio submissions reject disabled mobile accounts', function () {
    [$user, $token] = mobileTransitAdminUser('user');
    // Simulate a stale credential left by an external database update. Normal
    // application ban paths revoke every token immediately through the observer.
    DB::table('users')->where('id', $user->id)->update(['is_banned' => true]);

    $this->withToken($token)
        ->postJson('/api/v1/studio/routes', [
            'city_id' => 'damascus',
            'name_ar' => 'خط محظور',
            'geojson' => [
                'type' => 'FeatureCollection',
                'features' => [[
                    'geometry' => ['type' => 'LineString'],
                ]],
            ],
        ])
        ->assertForbidden()
        ->assertExactJson(['error' => 'account_disabled']);

    expect($user->tokens()->count())->toBe(0);
});

test('studio submissions reject malformed and unsupported GeoJSON', function (array $geojson) {
    $this->postJson('/api/v1/studio/routes', [
        'city_id' => 'damascus',
        'name_ar' => 'مسار غير صالح',
        'geojson' => $geojson,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('geojson');

    $this->assertDatabaseCount('route_drafts', 0);
})->with([
    'unsupported geometry' => [[
        'type' => 'FeatureCollection',
        'features' => [[
            'type' => 'Feature',
            'properties' => [],
            'geometry' => [
                'type' => 'MultiLineString',
                'coordinates' => [[[36.2, 33.4], [36.3, 33.5]]],
            ],
        ]],
    ]],
    'missing route line' => [[
        'type' => 'FeatureCollection',
        'features' => [[
            'type' => 'Feature',
            'properties' => ['nameAr' => 'محطة'],
            'geometry' => ['type' => 'Point', 'coordinates' => [36.2, 33.4]],
        ]],
    ]],
    'coordinate outside Syria' => [[
        'type' => 'FeatureCollection',
        'features' => [[
            'type' => 'Feature',
            'properties' => [],
            'geometry' => [
                'type' => 'LineString',
                'coordinates' => [[12.0, 51.0], [12.1, 51.1]],
            ],
        ]],
    ]],
    'line with one position' => [[
        'type' => 'FeatureCollection',
        'features' => [[
            'type' => 'Feature',
            'properties' => [],
            'geometry' => ['type' => 'LineString', 'coordinates' => [[36.2, 33.4]]],
        ]],
    ]],
    'line without distinct positions' => [[
        'type' => 'FeatureCollection',
        'features' => [[
            'type' => 'Feature',
            'properties' => [],
            'geometry' => [
                'type' => 'LineString',
                'coordinates' => [[36.2, 33.4], [36.2, 33.4]],
            ],
        ]],
    ]],
    'two route lines' => [[
        'type' => 'FeatureCollection',
        'features' => [
            [
                'type' => 'Feature',
                'properties' => [],
                'geometry' => [
                    'type' => 'LineString',
                    'coordinates' => [[36.2, 33.4], [36.3, 33.5]],
                ],
            ],
            [
                'type' => 'Feature',
                'properties' => [],
                'geometry' => [
                    'type' => 'LineString',
                    'coordinates' => [[36.4, 33.5], [36.5, 33.6]],
                ],
            ],
        ],
    ]],
]);

test('studio submissions enforce feature and coordinate limits', function (array $features) {
    $this->postJson('/api/v1/studio/routes', [
        'city_id' => 'damascus',
        'name_ar' => 'مسار كبير',
        'geojson' => [
            'type' => 'FeatureCollection',
            'features' => $features,
        ],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('geojson');
})->with([
    'too many route coordinates' => [[[
        'type' => 'Feature',
        'properties' => [],
        'geometry' => [
            'type' => 'LineString',
            'coordinates' => array_fill(
                0,
                TransitDraftGeoJson::MAX_ROUTE_COORDINATES + 1,
                [36.2, 33.4],
            ),
        ],
    ]]],
    'too many features' => [array_merge(
        [[
            'type' => 'Feature',
            'properties' => [],
            'geometry' => [
                'type' => 'LineString',
                'coordinates' => [[36.2, 33.4], [36.3, 33.5]],
            ],
        ]],
        array_fill(0, TransitDraftGeoJson::MAX_FEATURES, [
            'type' => 'Feature',
            'properties' => ['nameAr' => 'محطة'],
            'geometry' => ['type' => 'Point', 'coordinates' => [36.25, 33.45]],
        ]),
    )],
]);

test('reviewers cannot publish an invalid stored draft', function () {
    [$user, $token] = mobileTransitAdminUser('transit_admin');
    $draft = seedMobileTransitDraft($user);
    $draft->update([
        'geojson' => [
            'type' => 'FeatureCollection',
            'features' => [[
                'type' => 'Feature',
                'properties' => ['nameAr' => 'محطة بلا مسار'],
                'geometry' => ['type' => 'Point', 'coordinates' => [36.2, 33.4]],
            ]],
        ],
    ]);

    $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$draft->id}/approve")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('geojson');

    $this->assertDatabaseHas('route_drafts', [
        'id' => $draft->id,
        'status' => 'pending',
    ]);
    $this->assertDatabaseCount('routes', 0);
    $this->assertDatabaseCount('route_geometries', 0);
    $this->assertDatabaseCount('stops', 0);
});
