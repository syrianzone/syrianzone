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

function seedMobileTransitAdminStop(
    string $id,
    string $name,
    array $coordinates,
): void {
    DB::table('stops')->insert([
        'id' => $id,
        'city_id' => 'damascus',
        'name_ar' => $name,
        'geometry' => mobileTransitAdminGeometry([
            'type' => 'Point',
            'coordinates' => $coordinates,
        ]),
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
    [$user, $token] = mobileTransitAdminUser('transit_admin');
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
    $this->assertDatabaseHas('transit_route_logs', [
        'action' => 'hidden',
        'route_id' => $route->id,
        'user_id' => $user->id,
    ]);
    $this->withToken($token)
        ->getJson('/api/mobile/admin/routes/logs')
        ->assertOk()
        ->assertJsonPath('0.route_id', $route->id)
        ->assertJsonPath('0.user_id', $user->id);
});

test('published route listing exposes the assigned color index', function () {
    [, $token] = mobileTransitAdminUser('transit_admin');
    $route = Route::create([
        'color_index' => 4,
        'id' => 'route-damascus-color-list',
        'city_id' => 'damascus',
        'name_ar' => 'خط ملون',
        'status' => 'published',
    ]);

    $this->withToken($token)
        ->getJson('/api/mobile/admin/routes')
        ->assertOk()
        ->assertJsonPath('0.id', $route->id)
        ->assertJsonPath('0.color_index', 4);
});

test('a mobile transit reviewer can update a published route color', function () {
    [, $token] = mobileTransitAdminUser('transit_admin');
    $route = Route::create([
        'color_index' => 1,
        'id' => 'route-damascus-color-update',
        'city_id' => 'damascus',
        'name_ar' => 'خط قابل للتلوين',
        'status' => 'published',
    ]);

    $this->withToken($token)
        ->putJson("/api/mobile/admin/routes/{$route->id}", ['color_index' => 7])
        ->assertOk()
        ->assertJsonPath('route.color_index', 7);

    $this->assertDatabaseHas('routes', [
        'color_index' => 7,
        'id' => $route->id,
    ]);
});

test('transit approval and route updates reject colors outside the palette', function (int $colorIndex) {
    [$user, $token] = mobileTransitAdminUser('transit_admin');
    $draft = seedMobileTransitDraft($user);
    $route = Route::create([
        'color_index' => 1,
        'id' => 'route-damascus-invalid-color',
        'city_id' => 'damascus',
        'name_ar' => 'خط بلون ثابت',
        'status' => 'published',
    ]);

    $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$draft->id}/approve", [
            'color_index' => $colorIndex,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('color_index');
    $this->withToken($token)
        ->putJson("/api/mobile/admin/routes/{$route->id}", [
            'color_index' => $colorIndex,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('color_index');

    expect($draft->fresh()->status)->toBe('pending')
        ->and($route->fresh()->color_index)->toBe(1);
})->with([8, 80]);

test('published route updates reject an explicit null color', function () {
    [, $token] = mobileTransitAdminUser('transit_admin');
    $route = Route::create([
        'color_index' => 3,
        'id' => 'route-damascus-null-color',
        'city_id' => 'damascus',
        'name_ar' => 'خط بلون مطلوب',
        'status' => 'published',
    ]);

    $this->withToken($token)
        ->putJson("/api/mobile/admin/routes/{$route->id}", ['color_index' => null])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('color_index');

    expect($route->fresh()->color_index)->toBe(3);
});

test('an invalid split stop closes its database transaction', function () {
    $initialTransactionLevel = DB::transactionLevel();
    [, $token] = mobileTransitAdminUser('transit_admin');
    $route = Route::create([
        'id' => 'route-damascus-invalid-split',
        'city_id' => 'damascus',
        'name_ar' => 'خط لا يضم المحطة',
        'status' => 'published',
    ]);
    seedMobileTransitAdminStop(
        'stop-damascus-not-on-route',
        'محطة خارج الخط',
        [36.25, 33.45],
    );

    $this->withToken($token)
        ->postJson('/api/mobile/admin/routes/split', [
            'route_id' => $route->id,
            'split_stop_id' => 'stop-damascus-not-on-route',
            'name_a_ar' => 'القسم الأول',
            'name_b_ar' => 'القسم الثاني',
        ])
        ->assertBadRequest()
        ->assertJsonPath('message', 'Invalid split stop: cannot split at start or end stop');

    $finalTransactionLevel = DB::transactionLevel();
    while (DB::transactionLevel() > $initialTransactionLevel) {
        DB::rollBack();
    }

    expect($finalTransactionLevel)->toBe($initialTransactionLevel);
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

test('initial approval links the draft so reapproval updates one route', function () {
    [$contributor, $contributorToken] = mobileTransitAdminUser('user');
    [, $reviewerToken] = mobileTransitAdminUser('transit_admin');
    $draft = seedMobileTransitDraft($contributor);

    $firstApproval = $this->withToken($reviewerToken)
        ->postJson("/api/mobile/admin/transit-drafts/{$draft->id}/approve")
        ->assertOk();
    $routeId = $firstApproval->json('route.id');

    expect($draft->fresh()->route_id)->toBe($routeId);

    $this->withToken($contributorToken)
        ->putJson("/api/v1/studio/routes/{$draft->id}", [
            'name_ar' => 'الخط بعد التعديل',
        ])
        ->assertOk()
        ->assertJsonPath('status', 'pending');

    $this->withToken($reviewerToken)
        ->postJson("/api/mobile/admin/transit-drafts/{$draft->id}/approve")
        ->assertOk()
        ->assertJsonPath('route.id', $routeId)
        ->assertJsonPath('route.name_ar', 'الخط بعد التعديل');

    expect(Route::query()->count())->toBe(1)
        ->and($draft->fresh()->route_id)->toBe($routeId);
});

test('draft approval creates a route with the supplied color index', function () {
    [$user, $token] = mobileTransitAdminUser('transit_admin');
    $draft = seedMobileTransitDraft($user);

    $response = $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$draft->id}/approve", [
            'color_index' => 6,
        ])
        ->assertOk()
        ->assertJsonPath('route.color_index', 6);

    $this->assertDatabaseHas('routes', [
        'color_index' => 6,
        'id' => $response->json('route.id'),
    ]);
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

test('studio draft updates preserve the submission value limits', function (
    string $field,
    mixed $value,
) {
    [$user, $token] = mobileTransitAdminUser('user');
    $draft = seedMobileTransitDraft($user);
    $draft->update(['status' => 'rejected']);

    $this->withToken($token)
        ->putJson("/api/v1/studio/routes/{$draft->id}", [$field => $value])
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);

    expect($draft->fresh()->status)->toBe('rejected');
})->with([
    'negative fare' => ['price', -1],
    'oversized notes' => ['notes', str_repeat('x', 5_001)],
]);

test('anonymous studio contributions cannot target a published route', function () {
    $route = Route::create([
        'id' => 'route-damascus-anonymous-link',
        'city_id' => 'damascus',
        'name_ar' => 'خط منشور',
        'status' => 'published',
    ]);

    $this->postJson('/api/v1/studio/routes', [
        'route_id' => $route->id,
        'city_id' => 'damascus',
        'name_ar' => 'تعديل مجهول',
        'geojson' => seedMobileTransitDraft()->geojson,
    ])->assertUnauthorized();

    expect($route->fresh()->status)->toBe('published');
    $this->assertDatabaseMissing('route_drafts', ['route_id' => $route->id]);
});

test('a linked mobile draft keeps its route live and atomically updates it on approval', function () {
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
    expect($route->fresh()->status)->toBe('published');
    $this->assertDatabaseMissing('transit_route_logs', [
        'action' => 'unpublished_for_edit',
        'route_id' => $route->id,
    ]);

    [$reviewer, $reviewerToken] = mobileTransitAdminUser('transit_admin');
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
    $this->assertDatabaseHas('transit_route_logs', [
        'action' => 'updated_via_draft',
        'route_id' => $route->id,
        'user_id' => $reviewer->id,
    ]);
});

test('updating a linked draft keeps the published route live until approval', function () {
    [$contributor, $token] = mobileTransitAdminUser('user');
    $route = Route::create([
        'id' => 'route-damascus-linked-update',
        'city_id' => 'damascus',
        'name_ar' => 'الخط المنشور',
        'status' => 'published',
    ]);
    $draft = seedMobileTransitDraft($contributor);
    $draft->update([
        'route_id' => $route->id,
        'status' => 'rejected',
        'rejection_reason' => 'راجع المسار',
    ]);

    $this->withToken($token)
        ->putJson("/api/v1/studio/routes/{$draft->id}", ['name_ar' => 'المسار المصحح'])
        ->assertOk()
        ->assertJsonPath('status', 'pending');

    expect($route->fresh()->status)->toBe('published');
    $this->assertDatabaseMissing('transit_route_logs', [
        'action' => 'unpublished_for_edit',
        'route_id' => $route->id,
    ]);
});

test('linked draft approval preserves route color when color is omitted', function () {
    [$user, $token] = mobileTransitAdminUser('transit_admin');
    $route = Route::create([
        'color_index' => 5,
        'id' => 'route-damascus-color-preserved',
        'city_id' => 'damascus',
        'name_ar' => 'خط بلونه الحالي',
        'status' => 'published',
    ]);
    $draft = seedMobileTransitDraft($user);
    $draft->update(['route_id' => $route->id]);

    $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$draft->id}/approve")
        ->assertOk()
        ->assertJsonPath('route.color_index', 5);

    expect($route->fresh()->color_index)->toBe(5);
});

test('linked approval removes exclusive old stops and preserves shared stops', function () {
    [$user, $token] = mobileTransitAdminUser('transit_admin');
    $route = Route::create([
        'id' => 'route-damascus-stop-replacement',
        'city_id' => 'damascus',
        'name_ar' => 'خط سيحدث',
        'status' => 'published',
    ]);
    $sharingRoute = Route::create([
        'id' => 'route-damascus-shared-stop',
        'city_id' => 'damascus',
        'name_ar' => 'خط مشترك',
        'status' => 'published',
    ]);
    seedMobileTransitAdminStop(
        'stop-damascus-exclusive-old',
        'محطة قديمة حصرية',
        [36.21, 33.41],
    );
    seedMobileTransitAdminStop(
        'stop-damascus-shared-old',
        'محطة قديمة مشتركة',
        [36.22, 33.42],
    );
    DB::table('route_stop')->insert([
        [
            'route_id' => $route->id,
            'stop_id' => 'stop-damascus-exclusive-old',
            'order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ],
        [
            'route_id' => $route->id,
            'stop_id' => 'stop-damascus-shared-old',
            'order' => 2,
            'created_at' => now(),
            'updated_at' => now(),
        ],
        [
            'route_id' => $sharingRoute->id,
            'stop_id' => 'stop-damascus-shared-old',
            'order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ],
    ]);
    $draft = seedMobileTransitDraft($user);
    $draft->update(['route_id' => $route->id]);

    $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$draft->id}/approve")
        ->assertOk();

    $this->assertDatabaseMissing('stops', ['id' => 'stop-damascus-exclusive-old']);
    $this->assertDatabaseHas('stops', ['id' => 'stop-damascus-shared-old']);
    $this->assertDatabaseHas('route_stop', [
        'route_id' => $sharingRoute->id,
        'stop_id' => 'stop-damascus-shared-old',
    ]);
    $this->assertDatabaseMissing('route_stop', [
        'route_id' => $route->id,
        'stop_id' => 'stop-damascus-shared-old',
    ]);
});

test('linked draft approval updates route color when supplied', function () {
    [$user, $token] = mobileTransitAdminUser('transit_admin');
    $route = Route::create([
        'color_index' => 5,
        'id' => 'route-damascus-color-replaced',
        'city_id' => 'damascus',
        'name_ar' => 'خط بلون جديد',
        'status' => 'published',
    ]);
    $draft = seedMobileTransitDraft($user);
    $draft->update(['route_id' => $route->id]);

    $this->withToken($token)
        ->postJson("/api/mobile/admin/transit-drafts/{$draft->id}/approve", [
            'color_index' => 2,
        ])
        ->assertOk()
        ->assertJsonPath('route.color_index', 2);

    expect($route->fresh()->color_index)->toBe(2);
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
