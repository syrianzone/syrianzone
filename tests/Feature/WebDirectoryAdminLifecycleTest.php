<?php

use App\Http\Middleware\AutoLoginDevUser;
use App\Models\GovApp;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

function webDirectoryAdmin(): User
{
    return User::factory()->create([
        'is_banned' => false,
        'role' => 'superadmin',
    ]);
}

function seedWebOfficialCategory(string $id = 'ministries'): OfficialCategory
{
    return OfficialCategory::create([
        'icon' => null,
        'id' => $id,
        'is_active' => true,
        'label_ar' => 'الوزارات',
        'label_en' => 'Ministries',
        'order_column' => 1,
    ]);
}

function oversizedWebDirectoryPixelUpload(): UploadedFile
{
    $header = pack('NNCCCCC', 4001, 2000, 8, 2, 0, 0, 0);
    $chunk = 'IHDR'.$header;
    $bytes = "\x89PNG\r\n\x1a\n".pack('N', strlen($header)).$chunk.pack('N', crc32($chunk));
    $path = tempnam(sys_get_temp_dir(), 'web-directory-pixels').'.png';
    file_put_contents($path, $bytes);

    return new UploadedFile($path, 'web-directory-pixels.png', 'image/png', null, true);
}

beforeEach(function () {
    Storage::fake('public');
    config()->set('filesystems.media_disk', 'public');
    $this->withoutMiddleware(AutoLoginDevUser::class);
    $this->actingAs(webDirectoryAdmin());
});

test('web directory validation rejects decoded images above the shared pixel budget', function () {
    seedWebOfficialCategory();

    $this->from('/admin/syofficial')
        ->post('/api/v1/admin/syofficial/entities', [
            'category_id' => 'ministries',
            'id' => 'health',
            'image_file' => oversizedWebDirectoryPixelUpload(),
            'name' => 'Health',
            'name_ar' => 'الصحة',
        ])
        ->assertRedirect('/admin/syofficial')
        ->assertSessionHasErrors('image_file');

    expect(Storage::disk('public')->allFiles())->toBe([]);
    $this->assertDatabaseMissing('official_entities', ['id' => 'health']);
});

test('web government app replacement and deletion clean managed icons after commit', function () {
    $this->from('/admin/govapps')
        ->post('/api/v1/admin/govapps', [
            'icon_file' => UploadedFile::fake()->image('services.png', 96, 96),
            'id' => 'services',
            'name' => 'Services',
            'name_ar' => 'خدماتي',
        ])
        ->assertRedirect('/admin/govapps')
        ->assertSessionHas('success');
    $original = Storage::disk('public')->allFiles('directories/govapps')[0];

    $this->from('/admin/govapps')
        ->post('/api/v1/admin/govapps/services', [
            'icon_file' => UploadedFile::fake()->image('services-new.png', 128, 128),
            'name' => 'Services Syria',
            'name_ar' => 'خدمات سوريا',
        ])
        ->assertRedirect('/admin/govapps')
        ->assertSessionHas('success');
    $replacement = Storage::disk('public')->allFiles('directories/govapps')[0];
    expect($replacement)->not->toBe($original);
    Storage::disk('public')->assertMissing($original);
    Storage::disk('public')->assertExists($replacement);

    $this->from('/admin/govapps')
        ->delete('/api/v1/admin/govapps/services')
        ->assertRedirect('/admin/govapps')
        ->assertSessionHas('success');

    Storage::disk('public')->assertMissing($replacement);
    $this->assertSoftDeleted('gov_apps', ['id' => 'services']);
});

test('web government app reorder reaches the static route', function () {
    foreach ([['first', 1], ['second', 2]] as [$id, $order]) {
        GovApp::create([
            'icon' => null,
            'id' => $id,
            'images' => [],
            'is_active' => true,
            'links' => [],
            'name' => ucfirst($id),
            'name_ar' => $id === 'first' ? 'الأول' : 'الثاني',
            'order_column' => $order,
        ]);
    }

    $this->postJson('/api/v1/admin/govapps/reorder', [
        'orders' => [
            ['id' => 'second', 'order_column' => 1],
            ['id' => 'first', 'order_column' => 2],
        ],
    ])->assertOk();

    expect(GovApp::query()->findOrFail('second')->order_column)->toBe(1)
        ->and(GovApp::query()->findOrFail('first')->order_column)->toBe(2);
});

test('web government app create rollback discards the newly stored icon', function () {
    DB::unprepared(
        "CREATE TRIGGER reject_web_gov_app_insert BEFORE INSERT ON gov_apps
        BEGIN SELECT RAISE(ABORT, 'forced web gov app insert failure'); END",
    );
    $this->withoutExceptionHandling();

    try {
        expect(fn () => $this->post('/api/v1/admin/govapps', [
            'icon_file' => UploadedFile::fake()->image('services.png', 96, 96),
            'id' => 'services',
            'name' => 'Services',
            'name_ar' => 'خدماتي',
        ]))->toThrow(QueryException::class);
    } finally {
        DB::unprepared('DROP TRIGGER reject_web_gov_app_insert');
        $this->withExceptionHandling();
    }

    expect(Storage::disk('public')->allFiles('directories/govapps'))->toBe([]);
    $this->assertDatabaseMissing('gov_apps', ['id' => 'services']);
});

test('web government app deletion preserves an external icon and cleans a proven legacy icon', function () {
    $path = 'directories/govapps/'.Str::uuid().'.png';
    $legacyPath = 'govapps/legacy_1720000000.webp';
    Storage::disk('public')->put($path, 'external lookalike');
    Storage::disk('public')->put($legacyPath, 'legacy icon');
    GovApp::create([
        'icon' => 'https://cdn.example/storage/'.$path,
        'id' => 'external',
        'images' => [],
        'is_active' => true,
        'links' => [],
        'name' => 'External',
        'name_ar' => 'خارجي',
        'order_column' => 1,
    ]);
    GovApp::create([
        'icon' => Storage::disk('public')->url($legacyPath),
        'id' => 'legacy',
        'images' => [],
        'is_active' => true,
        'links' => [],
        'name' => 'Legacy',
        'name_ar' => 'قديم',
        'order_column' => 2,
    ]);

    $this->delete('/api/v1/admin/govapps/external')->assertRedirect();
    $this->delete('/api/v1/admin/govapps/legacy')->assertRedirect();

    Storage::disk('public')->assertExists($path);
    Storage::disk('public')->assertMissing($legacyPath);
});

test('web official entity replacement deletion and category cascade clean managed images', function () {
    seedWebOfficialCategory();

    $this->post('/api/v1/admin/syofficial/entities', [
        'category_id' => 'ministries',
        'id' => 'health',
        'image_file' => UploadedFile::fake()->image('health.png', 128, 128),
        'name' => 'Health',
        'name_ar' => 'الصحة',
    ])->assertRedirect()->assertSessionHas('success');
    $original = Storage::disk('public')->allFiles('directories/syofficial')[0];

    $this->post('/api/v1/admin/syofficial/entities/health', [
        'category_id' => 'ministries',
        'image_file' => UploadedFile::fake()->image('health-new.webp', 160, 160),
        'name' => 'Health authority',
        'name_ar' => 'هيئة الصحة',
    ])->assertRedirect()->assertSessionHas('success');
    $replacement = Storage::disk('public')->allFiles('directories/syofficial')[0];
    expect($replacement)->not->toBe($original);
    Storage::disk('public')->assertMissing($original);

    $this->delete('/api/v1/admin/syofficial/entities/health')->assertRedirect();
    Storage::disk('public')->assertMissing($replacement);

    foreach (['education', 'transport'] as $id) {
        $this->post('/api/v1/admin/syofficial/entities', [
            'category_id' => 'ministries',
            'id' => $id,
            'image_file' => UploadedFile::fake()->image("{$id}.png", 128, 128),
            'name' => ucfirst($id),
            'name_ar' => $id === 'education' ? 'التعليم' : 'النقل',
        ])->assertRedirect();
    }
    $cascadePaths = Storage::disk('public')->allFiles('directories/syofficial');
    expect($cascadePaths)->toHaveCount(2);
    $legacyPath = 'syofficial/entities/legacy_1720000000.webp';
    Storage::disk('public')->put($legacyPath, 'legacy official image');
    OfficialEntity::create([
        'category_id' => 'ministries',
        'id' => 'legacy',
        'image' => Storage::disk('public')->url($legacyPath),
        'is_active' => true,
        'name' => 'Legacy',
        'name_ar' => 'قديم',
        'order_column' => 3,
        'socials' => [],
    ]);

    $this->delete('/api/v1/admin/syofficial/categories/ministries')->assertRedirect();

    Storage::disk('public')->assertMissing($cascadePaths);
    Storage::disk('public')->assertMissing($legacyPath);
    $this->assertDatabaseMissing('official_categories', ['id' => 'ministries']);
    $this->assertDatabaseCount('official_entities', 0);
});
