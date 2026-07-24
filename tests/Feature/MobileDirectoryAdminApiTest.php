<?php

use App\Models\GovApp;
use App\Models\MediaCleanupJob;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route as RouteFacade;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

function mobileDirectoryAdminCredentials(array $attributes = []): array
{
    $user = User::factory()->create(array_merge([
        'is_banned' => false,
        'permissions' => [],
        'role' => 'user',
    ], $attributes));
    $token = $user->createToken('mobile:directory-admin-test', ['mobile'], now()->addHour());

    return [$user, $token->plainTextToken];
}

function seedMobileOfficialCategory(string $id = 'ministries', int $order = 1): OfficialCategory
{
    return OfficialCategory::create([
        'icon' => null,
        'id' => $id,
        'is_active' => true,
        'label_ar' => 'الوزارات',
        'label_en' => 'Ministries',
        'order_column' => $order,
    ]);
}

function seedMobileOfficialEntity(string $id = 'health', int $order = 1): OfficialEntity
{
    return OfficialEntity::create([
        'category_id' => 'ministries',
        'description' => null,
        'description_ar' => null,
        'id' => $id,
        'image' => null,
        'is_active' => true,
        'name' => 'Health',
        'name_ar' => 'الصحة',
        'order_column' => $order,
        'socials' => [],
    ]);
}

function seedMobilePhonebookCategory(string $id = 'emergency', int $order = 1): PhonebookCategory
{
    return PhonebookCategory::create([
        'icon' => null,
        'id' => $id,
        'is_active' => true,
        'label_ar' => 'الطوارئ',
        'label_en' => 'Emergency',
        'order_column' => $order,
    ]);
}

test('mobile directory administration exposes the native route contract', function () {
    $routes = collect(RouteFacade::getRoutes())
        ->filter(fn ($route): bool => str_starts_with($route->uri(), 'api/mobile/admin/'))
        ->flatMap(fn ($route) => collect($route->methods())
            ->reject(fn (string $method): bool => $method === 'HEAD')
            ->map(fn (string $method): string => "{$method} {$route->uri()}"))
        ->values();

    expect($routes)->toContain(
        'GET api/mobile/admin/syofficial',
        'POST api/mobile/admin/syofficial/categories',
        'PUT api/mobile/admin/syofficial/categories/{id}',
        'DELETE api/mobile/admin/syofficial/categories/{id}',
        'POST api/mobile/admin/syofficial/entities',
        'POST api/mobile/admin/syofficial/entities/{id}',
        'PATCH api/mobile/admin/syofficial/entities/{id}/visibility',
        'DELETE api/mobile/admin/syofficial/entities/{id}',
        'POST api/mobile/admin/syofficial/reorder/categories',
        'POST api/mobile/admin/syofficial/reorder/entities',
        'GET api/mobile/admin/govapps',
        'POST api/mobile/admin/govapps',
        'POST api/mobile/admin/govapps/{id}',
        'PATCH api/mobile/admin/govapps/{id}/visibility',
        'DELETE api/mobile/admin/govapps/{id}',
        'POST api/mobile/admin/govapps/reorder',
        'GET api/mobile/admin/phonebook',
        'POST api/mobile/admin/phonebook/categories',
        'PUT api/mobile/admin/phonebook/categories/{id}',
        'DELETE api/mobile/admin/phonebook/categories/{id}',
        'POST api/mobile/admin/phonebook/entries',
        'PUT api/mobile/admin/phonebook/entries/{id}',
        'PATCH api/mobile/admin/phonebook/entries/{id}/visibility',
        'DELETE api/mobile/admin/phonebook/entries/{id}',
        'POST api/mobile/admin/phonebook/reorder/categories',
        'POST api/mobile/admin/phonebook/reorder/entries',
    );
});

test('mobile directory administration requires mobile bearer provenance', function (string $path) {
    $this->getJson($path)->assertUnauthorized();

    $user = User::factory()->create(['role' => 'superadmin']);
    $browserToken = $user->createToken('browser-session');
    $this->withToken($browserToken->plainTextToken)
        ->getJson($path)
        ->assertUnauthorized();

    [, $mobileToken] = mobileDirectoryAdminCredentials();
    $this->withToken($mobileToken)
        ->getJson($path)
        ->assertForbidden();
})->with([
    '/api/mobile/admin/syofficial',
    '/api/mobile/admin/govapps',
    '/api/mobile/admin/phonebook',
]);

test('module roles and core administrators can list their directory data', function (
    string $role,
    string $path,
) {
    [, $token] = mobileDirectoryAdminCredentials(['role' => $role]);

    $this->withToken($token)->getJson($path)->assertOk()->assertJsonStructure(['data']);
})->with([
    'core admin official accounts' => ['admin', '/api/mobile/admin/syofficial'],
    'core admin government apps' => ['admin', '/api/mobile/admin/govapps'],
    'core admin phonebook' => ['admin', '/api/mobile/admin/phonebook'],
    'superadmin official accounts' => ['superadmin', '/api/mobile/admin/syofficial'],
    'SyOfficial administrator' => ['syofficial_admin', '/api/mobile/admin/syofficial'],
    'GovApps administrator' => ['govapps_admin', '/api/mobile/admin/govapps'],
    'Phonebook administrator' => ['phonebook_admin', '/api/mobile/admin/phonebook'],
]);

test('a granular permission grants module listing but not a different action', function () {
    [, $token] = mobileDirectoryAdminCredentials([
        'permissions' => ['syofficial.edit'],
    ]);

    $this->withToken($token)
        ->getJson('/api/mobile/admin/syofficial')
        ->assertOk();

    $this->withToken($token)
        ->postJson('/api/mobile/admin/syofficial/categories', [
            'id' => 'ministries',
            'is_active' => true,
            'label_ar' => 'الوزارات',
            'label_en' => 'Ministries',
        ])
        ->assertForbidden();
});

test('SyOfficial mobile administration supports CRUD visibility reorder and bounded images', function () {
    Storage::fake('public');
    config()->set('filesystems.media_disk', 'public');
    [, $token] = mobileDirectoryAdminCredentials([
        'permissions' => [
            'syofficial.create',
            'syofficial.delete',
            'syofficial.edit',
            'syofficial.reorder',
            'syofficial.toggle',
        ],
    ]);

    $this->withToken($token)
        ->postJson('/api/mobile/admin/syofficial/categories', [
            'icon' => 'building',
            'id' => 'ministries',
            'is_active' => true,
            'label_ar' => 'الوزارات',
            'label_en' => 'Ministries',
        ])
        ->assertCreated()
        ->assertExactJson(['data' => [
            'icon' => 'building',
            'id' => 'ministries',
            'is_active' => true,
            'label_ar' => 'الوزارات',
            'label_en' => 'Ministries',
            'order_column' => 1,
        ]]);

    $this->withToken($token)
        ->postJson('/api/mobile/admin/syofficial/categories', [
            'icon' => null,
            'id' => 'governorates',
            'is_active' => false,
            'label_ar' => 'المحافظات',
            'label_en' => 'Governorates',
        ])
        ->assertCreated();

    $created = $this->withToken($token)
        ->post('/api/mobile/admin/syofficial/entities', [
            'category_id' => 'ministries',
            'description' => 'Public health services',
            'description_ar' => 'خدمات الصحة العامة',
            'id' => 'health',
            'image_file' => UploadedFile::fake()->image('health.jpg', 128, 128),
            'is_active' => '1',
            'name' => 'Health',
            'name_ar' => 'الصحة',
            'socials' => ['website' => 'https://health.example'],
        ]);

    $created->assertCreated()
        ->assertJsonPath('data.id', 'health')
        ->assertJsonPath('data.socials.website', 'https://health.example')
        ->assertJsonPath('data.is_active', true);
    expect($created->json('data.image'))->toBeString()->not->toBeEmpty();
    $originalImagePath = Storage::disk('public')->allFiles('directories/syofficial')[0];

    $this->withToken($token)
        ->post('/api/mobile/admin/syofficial/entities/health', [
            'category_id' => 'governorates',
            'description' => '',
            'description_ar' => '',
            'image_file' => UploadedFile::fake()->image('health-new.webp', 160, 160),
            'is_active' => '1',
            'name' => 'Health authority',
            'name_ar' => 'هيئة الصحة',
            'socials' => [],
        ])
        ->assertOk()
        ->assertJsonPath('data.category_id', 'governorates')
        ->assertJsonPath('data.name', 'Health authority');
    $replacementImagePath = Storage::disk('public')->allFiles('directories/syofficial')[0];
    expect($replacementImagePath)->not->toBe($originalImagePath);
    Storage::disk('public')->assertMissing($originalImagePath);
    Storage::disk('public')->assertExists($replacementImagePath);

    $this->withToken($token)
        ->patchJson('/api/mobile/admin/syofficial/entities/health/visibility', [
            'is_active' => false,
        ])
        ->assertOk()
        ->assertJsonPath('data.is_active', false);

    $this->withToken($token)
        ->postJson('/api/mobile/admin/syofficial/reorder/categories', [
            'orders' => [
                ['id' => 'governorates', 'order_column' => 1],
                ['id' => 'ministries', 'order_column' => 2],
            ],
        ])
        ->assertOk()
        ->assertExactJson(['data' => ['success' => true]]);

    $this->withToken($token)
        ->postJson('/api/mobile/admin/syofficial/reorder/entities', [
            'orders' => [['id' => 'health', 'order_column' => 3]],
        ])
        ->assertOk()
        ->assertExactJson(['data' => ['success' => true]]);

    $list = $this->withToken($token)
        ->getJson('/api/mobile/admin/syofficial')
        ->assertOk()
        ->assertJsonPath('data.categories.0.id', 'governorates')
        ->assertJsonPath('data.entities.0.order_column', 3)
        ->assertJsonPath('data.entities.0.socials', []);
    expect($list->getContent())->toContain('"socials":{}');

    $this->withToken($token)
        ->deleteJson('/api/mobile/admin/syofficial/entities/health')
        ->assertOk()
        ->assertExactJson(['data' => ['deleted' => true]]);
    Storage::disk('public')->assertMissing($replacementImagePath);
    $this->withToken($token)
        ->deleteJson('/api/mobile/admin/syofficial/categories/governorates')
        ->assertOk();
});

test('government app mobile administration supports CRUD visibility and reorder', function () {
    Storage::fake('public');
    config()->set('filesystems.media_disk', 'public');
    [, $token] = mobileDirectoryAdminCredentials(['role' => 'govapps_admin']);

    $created = $this->withToken($token)
        ->post('/api/mobile/admin/govapps', [
            'description' => 'Government services',
            'description_ar' => 'خدمات حكومية',
            'icon_file' => UploadedFile::fake()->image('services.png', 96, 96),
            'id' => 'services',
            'is_active' => '1',
            'links' => [
                'android' => 'https://play.google.com/store/apps/details?id=example',
                'official' => 'https://services.example',
            ],
            'name' => 'Services',
            'name_ar' => 'خدماتي',
        ]);

    $created->assertCreated()
        ->assertJsonPath('data.id', 'services')
        ->assertJsonPath('data.images', [])
        ->assertJsonPath('data.links.official', 'https://services.example');
    $originalIconPath = Storage::disk('public')->allFiles('directories/govapps')[0];

    $this->withToken($token)
        ->post('/api/mobile/admin/govapps/services', [
            'description' => '',
            'description_ar' => '',
            'icon_file' => UploadedFile::fake()->image('services-new.png', 128, 128),
            'is_active' => '1',
            'links' => ['apple' => 'https://apps.apple.com/app/example'],
            'name' => 'Services Syria',
            'name_ar' => 'خدمات سوريا',
        ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Services Syria')
        ->assertJsonPath('data.links.apple', 'https://apps.apple.com/app/example');
    $replacementIconPath = Storage::disk('public')->allFiles('directories/govapps')[0];
    expect($replacementIconPath)->not->toBe($originalIconPath);
    Storage::disk('public')->assertMissing($originalIconPath);
    Storage::disk('public')->assertExists($replacementIconPath);

    $this->withToken($token)
        ->patchJson('/api/mobile/admin/govapps/services/visibility', ['is_active' => false])
        ->assertOk()
        ->assertJsonPath('data.is_active', false);

    GovApp::create([
        'id' => 'identity',
        'images' => [],
        'is_active' => true,
        'links' => [],
        'name' => 'Identity',
        'name_ar' => 'هويتي',
        'order_column' => 2,
    ]);
    $this->withToken($token)
        ->postJson('/api/mobile/admin/govapps/reorder', [
            'orders' => [
                ['id' => 'identity', 'order_column' => 1],
                ['id' => 'services', 'order_column' => 2],
            ],
        ])
        ->assertOk()
        ->assertExactJson(['data' => ['success' => true]]);

    $list = $this->withToken($token)
        ->getJson('/api/mobile/admin/govapps')
        ->assertOk()
        ->assertJsonPath('data.0.id', 'identity')
        ->assertJsonPath('data.1.id', 'services');
    expect($list->getContent())->toContain('"links":{}');

    $this->withToken($token)
        ->deleteJson('/api/mobile/admin/govapps/services')
        ->assertOk()
        ->assertExactJson(['data' => ['deleted' => true]]);
    Storage::disk('public')->assertMissing($replacementIconPath);
});

test('directory create rollback discards a newly stored government app icon', function () {
    Storage::fake('public');
    config()->set('filesystems.media_disk', 'public');
    [, $token] = mobileDirectoryAdminCredentials(['role' => 'govapps_admin']);
    DB::unprepared(
        "CREATE TRIGGER reject_gov_app_insert BEFORE INSERT ON gov_apps
        BEGIN SELECT RAISE(ABORT, 'forced gov app insert failure'); END",
    );
    $this->withoutExceptionHandling();

    try {
        expect(fn () => $this->withToken($token)
            ->post('/api/mobile/admin/govapps', [
                'icon_file' => UploadedFile::fake()->image('services.png', 96, 96),
                'id' => 'services',
                'is_active' => '1',
                'name' => 'Services',
                'name_ar' => 'خدماتي',
            ]))->toThrow(QueryException::class);
    } finally {
        DB::unprepared('DROP TRIGGER reject_gov_app_insert');
        $this->withExceptionHandling();
    }

    expect(Storage::disk('public')->allFiles('directories/govapps'))->toBe([]);
    $this->assertDatabaseMissing('gov_apps', ['id' => 'services']);
});

test('directory update rollback discards the replacement and preserves the official image', function () {
    Storage::fake('public');
    config()->set('filesystems.media_disk', 'public');
    seedMobileOfficialCategory();
    [, $token] = mobileDirectoryAdminCredentials(['role' => 'syofficial_admin']);
    $created = $this->withToken($token)
        ->post('/api/mobile/admin/syofficial/entities', [
            'category_id' => 'ministries',
            'id' => 'health',
            'image_file' => UploadedFile::fake()->image('health.png', 128, 128),
            'is_active' => '1',
            'name' => 'Health',
            'name_ar' => 'الصحة',
        ])
        ->assertCreated();
    $originalUrl = $created->json('data.image');
    $originalPath = Storage::disk('public')->allFiles('directories/syofficial')[0];
    DB::unprepared(
        "CREATE TRIGGER reject_official_entity_update BEFORE UPDATE ON official_entities
        BEGIN SELECT RAISE(ABORT, 'forced official entity update failure'); END",
    );
    $this->withoutExceptionHandling();

    try {
        expect(fn () => $this->withToken($token)
            ->post('/api/mobile/admin/syofficial/entities/health', [
                'category_id' => 'ministries',
                'image_file' => UploadedFile::fake()->image('replacement.png', 160, 160),
                'is_active' => '1',
                'name' => 'Health authority',
                'name_ar' => 'هيئة الصحة',
            ]))->toThrow(QueryException::class);
    } finally {
        DB::unprepared('DROP TRIGGER reject_official_entity_update');
        $this->withExceptionHandling();
    }

    expect(Storage::disk('public')->allFiles('directories/syofficial'))->toBe([$originalPath])
        ->and(OfficialEntity::query()->findOrFail('health')->image)->toBe($originalUrl)
        ->and(MediaCleanupJob::query()->count())->toBe(0);
});

test('directory delete rollback preserves the government app icon and cleanup state', function () {
    Storage::fake('public');
    config()->set('filesystems.media_disk', 'public');
    [, $token] = mobileDirectoryAdminCredentials(['role' => 'govapps_admin']);
    $this->withToken($token)
        ->post('/api/mobile/admin/govapps', [
            'icon_file' => UploadedFile::fake()->image('services.png', 96, 96),
            'id' => 'services',
            'is_active' => '1',
            'name' => 'Services',
            'name_ar' => 'خدماتي',
        ])
        ->assertCreated();
    $originalPath = Storage::disk('public')->allFiles('directories/govapps')[0];
    DB::unprepared(
        "CREATE TRIGGER reject_gov_app_delete BEFORE UPDATE ON gov_apps
        BEGIN SELECT RAISE(ABORT, 'forced gov app delete failure'); END",
    );
    $this->withoutExceptionHandling();

    try {
        expect(fn () => $this->withToken($token)
            ->deleteJson('/api/mobile/admin/govapps/services'))
            ->toThrow(QueryException::class);
    } finally {
        DB::unprepared('DROP TRIGGER reject_gov_app_delete');
        $this->withExceptionHandling();
    }

    Storage::disk('public')->assertExists($originalPath);
    $this->assertDatabaseHas('gov_apps', ['id' => 'services', 'deleted_at' => null]);
    expect(MediaCleanupJob::query()->count())->toBe(0);
});

test('directory deletion never touches external or unrelated image paths', function () {
    Storage::fake('public');
    config()->set('filesystems.media_disk', 'public');
    [, $token] = mobileDirectoryAdminCredentials(['role' => 'govapps_admin']);
    $externalFile = 'directories/govapps/'.Str::uuid().'.png';
    $unrelatedFile = 'directories/syofficial/'.Str::uuid().'.png';
    Storage::disk('public')->put($externalFile, 'external lookalike');
    Storage::disk('public')->put($unrelatedFile, 'unrelated managed file');
    GovApp::create([
        'icon' => 'https://cdn.example/storage/'.$externalFile,
        'id' => 'external',
        'images' => [],
        'is_active' => true,
        'links' => [],
        'name' => 'External',
        'name_ar' => 'خارجي',
        'order_column' => 1,
    ]);
    GovApp::create([
        'icon' => Storage::disk('public')->url($unrelatedFile),
        'id' => 'unrelated',
        'images' => [],
        'is_active' => true,
        'links' => [],
        'name' => 'Unrelated',
        'name_ar' => 'غير مرتبط',
        'order_column' => 2,
    ]);

    $this->withToken($token)->deleteJson('/api/mobile/admin/govapps/external')->assertOk();
    $this->withToken($token)->deleteJson('/api/mobile/admin/govapps/unrelated')->assertOk();

    Storage::disk('public')->assertExists([$externalFile, $unrelatedFile]);
    expect(MediaCleanupJob::query()->count())->toBe(0);
});

test('official category deletion cleans managed images from cascaded entities', function () {
    Storage::fake('public');
    config()->set('filesystems.media_disk', 'public');
    seedMobileOfficialCategory();
    [, $token] = mobileDirectoryAdminCredentials(['role' => 'syofficial_admin']);

    foreach (['health', 'education'] as $id) {
        $this->withToken($token)
            ->post('/api/mobile/admin/syofficial/entities', [
                'category_id' => 'ministries',
                'id' => $id,
                'image_file' => UploadedFile::fake()->image("{$id}.png", 128, 128),
                'is_active' => '1',
                'name' => ucfirst($id),
                'name_ar' => $id === 'health' ? 'الصحة' : 'التعليم',
            ])
            ->assertCreated();
    }
    $paths = Storage::disk('public')->allFiles('directories/syofficial');
    expect($paths)->toHaveCount(2);

    $this->withToken($token)
        ->deleteJson('/api/mobile/admin/syofficial/categories/ministries')
        ->assertOk()
        ->assertExactJson(['data' => ['deleted' => true]]);

    Storage::disk('public')->assertMissing($paths);
    $this->assertDatabaseMissing('official_categories', ['id' => 'ministries']);
    $this->assertDatabaseCount('official_entities', 0);
});

test('phonebook mobile administration supports CRUD visibility and reorder', function () {
    [, $token] = mobileDirectoryAdminCredentials([
        'permissions' => [
            'phonebook.create',
            'phonebook.delete',
            'phonebook.edit',
            'phonebook.reorder',
            'phonebook.toggle',
        ],
    ]);

    $this->withToken($token)
        ->postJson('/api/mobile/admin/phonebook/categories', [
            'icon' => 'phone',
            'id' => 'emergency',
            'is_active' => true,
            'label_ar' => 'الطوارئ',
            'label_en' => 'Emergency',
        ])
        ->assertCreated()
        ->assertJsonPath('data.order_column', 1);
    seedMobilePhonebookCategory('services', 2);

    $created = $this->withToken($token)
        ->postJson('/api/mobile/admin/phonebook/entries', [
            'category_id' => 'emergency',
            'is_active' => true,
            'is_whatsapp' => true,
            'name_ar' => 'الإسعاف',
            'name_en' => 'Ambulance',
            'number' => '110',
            'source_url' => 'https://health.example/ambulance',
        ])
        ->assertCreated()
        ->assertJsonPath('data.category_id', 'emergency')
        ->assertJsonPath('data.is_whatsapp', true);
    $entryId = $created->json('data.id');
    expect($entryId)->toBeString()->not->toBeEmpty();

    $this->withToken($token)
        ->putJson("/api/mobile/admin/phonebook/entries/{$entryId}", [
            'category_id' => 'services',
            'is_active' => true,
            'is_whatsapp' => false,
            'name_ar' => 'الإسعاف المركزي',
            'name_en' => null,
            'number' => '011110',
            'source_url' => null,
        ])
        ->assertOk()
        ->assertJsonPath('data.category_id', 'services')
        ->assertJsonPath('data.is_whatsapp', false);

    $this->withToken($token)
        ->patchJson("/api/mobile/admin/phonebook/entries/{$entryId}/visibility", [
            'is_active' => false,
        ])
        ->assertOk()
        ->assertJsonPath('data.is_active', false);

    $this->withToken($token)
        ->putJson('/api/mobile/admin/phonebook/categories/services', [
            'icon' => null,
            'is_active' => false,
            'label_ar' => 'الخدمات العامة',
            'label_en' => 'Public services',
        ])
        ->assertOk()
        ->assertJsonPath('data.is_active', false);

    $this->withToken($token)
        ->postJson('/api/mobile/admin/phonebook/reorder/categories', [
            'order' => ['services', 'emergency'],
        ])
        ->assertOk()
        ->assertExactJson(['data' => ['success' => true]]);
    $this->withToken($token)
        ->postJson('/api/mobile/admin/phonebook/reorder/entries', [
            'order' => [$entryId],
        ])
        ->assertOk();

    $this->withToken($token)
        ->getJson('/api/mobile/admin/phonebook')
        ->assertOk()
        ->assertJsonPath('data.categories.0.id', 'services')
        ->assertJsonPath('data.entries.0.id', $entryId);

    $this->withToken($token)
        ->deleteJson("/api/mobile/admin/phonebook/entries/{$entryId}")
        ->assertOk()
        ->assertExactJson(['data' => ['deleted' => true]]);
    $this->withToken($token)
        ->deleteJson('/api/mobile/admin/phonebook/categories/services')
        ->assertOk();
});

test('visibility requires toggle permission instead of general edit permission', function (
    string $permission,
    string $path,
) {
    seedMobileOfficialCategory();
    seedMobileOfficialEntity();
    GovApp::create([
        'id' => 'services',
        'images' => [],
        'is_active' => true,
        'links' => [],
        'name' => 'Services',
        'name_ar' => 'خدماتي',
        'order_column' => 1,
    ]);
    seedMobilePhonebookCategory();
    PhonebookEntry::create([
        'category_id' => 'emergency',
        'id' => 'ambulance',
        'is_active' => true,
        'is_whatsapp' => false,
        'name_ar' => 'الإسعاف',
        'number' => '110',
        'order_column' => 1,
    ]);
    [, $token] = mobileDirectoryAdminCredentials(['permissions' => [$permission]]);

    $this->withToken($token)
        ->patchJson($path, ['is_active' => false])
        ->assertForbidden();
})->with([
    'SyOfficial edit' => ['syofficial.edit', '/api/mobile/admin/syofficial/entities/health/visibility'],
    'GovApps edit' => ['govapps.edit', '/api/mobile/admin/govapps/services/visibility'],
    'phonebook edit' => ['phonebook.edit', '/api/mobile/admin/phonebook/entries/ambulance/visibility'],
]);

test('directory image uploads reject oversized files unsafe dimensions and unsupported types', function (
    UploadedFile $image,
) {
    Storage::fake('public');
    config()->set('filesystems.media_disk', 'public');
    seedMobileOfficialCategory();
    [, $token] = mobileDirectoryAdminCredentials([
        'permissions' => ['syofficial.create'],
    ]);

    $this->withToken($token)
        ->withHeader('Accept', 'application/json')
        ->post('/api/mobile/admin/syofficial/entities', [
            'category_id' => 'ministries',
            'id' => 'health',
            'image_file' => $image,
            'is_active' => '1',
            'name' => 'Health',
            'name_ar' => 'الصحة',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('image_file');

    expect(Storage::disk('public')->allFiles())->toBe([]);
    $this->assertDatabaseMissing('official_entities', ['id' => 'health']);
})->with([
    'file over five megabytes' => fn () => UploadedFile::fake()
        ->image('health.jpg', 128, 128)
        ->size(5_121),
    'image wider than the decode budget' => fn () => UploadedFile::fake()
        ->image('health.jpg', 6_001, 64),
    'unsupported image type' => fn () => UploadedFile::fake()
        ->create('health.svg', 50, 'image/svg+xml'),
]);
