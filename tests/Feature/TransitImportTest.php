<?php

use App\Models\User;
use App\Services\TransitKmlImportService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

function transitAdmin(): User
{
    return User::factory()->create(['role' => 'transit_admin']);
}

function seedTransitCity(string $id = 'homs'): void
{
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
        'name_ar' => 'حمص',
        'name_en' => 'Homs',
        'center' => $geometry(['type' => 'Point', 'coordinates' => [36.72, 34.73]]),
        'bounds' => $geometry([
            'type' => 'Polygon',
            'coordinates' => [[[36.5, 34.55], [36.95, 34.55], [36.95, 34.95], [36.5, 34.95], [36.5, 34.55]]],
        ]),
        'zoom' => 12,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

function singleKml(): string
{
    return file_get_contents(base_path('tests/Fixtures/transit-single.kml'));
}

// ─── Service unit behavior ──────────────────────────────────────────────

test('extractMid accepts share urls and bare mids', function () {
    $s = new TransitKmlImportService;

    expect($s->extractMid('https://www.google.com/maps/d/u/0/edit?mid=1eldQB_s9AbKbJ2-4NITj3DqkzDKQtL4&usp=sharing'))
        ->toBe('1eldQB_s9AbKbJ2-4NITj3DqkzDKQtL4')
        ->and($s->extractMid('1eldQB_s9AbKbJ2-4NITj3DqkzDKQtL4'))
        ->toBe('1eldQB_s9AbKbJ2-4NITj3DqkzDKQtL4')
        ->and($s->extractMid('https://google.com/maps?q=damascus'))
        ->toBeNull()
        ->and($s->extractMid('https://evil.com/maps/d/kml?mid=short'))
        ->toBeNull();
});

test('parseKml maps the homs fixture to one candidate with deduped stops', function () {
    $candidates = (new TransitKmlImportService)->parseKml(singleKml());

    expect($candidates)->toHaveCount(1);
    $c = $candidates[0];
    expect($c['name_ar'])->toBe('خط وعر قصر عدلي (المحكمة) - غوطة - السوق')
        ->and($c['price'])->toBe(30)
        ->and($c['vertex_count'])->toBe(4)
        ->and($c['stop_count'])->toBe(3)
        ->and($c['geojson']['type'])->toBe('FeatureCollection')
        ->and($c['geojson']['features'][0]['geometry']['type'])->toBe('LineString')
        ->and($c['bounds'][0])->toBeGreaterThanOrEqual(36.66)
        ->and(implode(' ', $c['warnings']))->toContain('مكررة');
});

test('parseKml splits multi-line maps and assigns each stop once', function () {
    $kml = file_get_contents(base_path('tests/Fixtures/transit-multi.kml'));
    $candidates = (new TransitKmlImportService)->parseKml($kml);

    expect($candidates)->toHaveCount(2);
    $totalStops = $candidates[0]['stop_count'] + $candidates[1]['stop_count'];
    expect($totalStops)->toBe(2)
        ->and($candidates[0]['name_ar'])->toBe('خط الوعر')
        ->and($candidates[1]['name_ar'])->toBe('خط الإنشاءات');
});

test('parseKml rejects maps without drawable geometry', function () {
    expect(fn () => (new TransitKmlImportService)->parseKml(
        '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>empty</name></Document></kml>'
    ))->toThrow(RuntimeException::class);
});

test('parsePrice handles arabic-indic digits', function () {
    $s = new TransitKmlImportService;

    expect($s->parsePrice('التعرفة ٣٠ ليرة'))->toBe(30)
        ->and($s->parsePrice('price: 1,500'))->toBe(1500)
        ->and($s->parsePrice('مجاناً'))->toBeNull()
        ->and($s->parsePrice(null))->toBeNull();
});

// ─── Preview endpoint ───────────────────────────────────────────────────

test('import-preview rejects guests and non-admins', function () {
    $user = User::factory()->create(['role' => 'user']);

    $this->postJson('/api/v1/admin/routes/import-preview', ['url' => 'https://www.google.com/maps/d/?mid=abc'])
        ->assertUnauthorized();

    $this->actingAs($user)
        ->postJson('/api/v1/admin/routes/import-preview', ['url' => 'https://www.google.com/maps/d/?mid=abc'])
        ->assertForbidden();
});

test('import-preview requires a url, mid, or file', function () {
    $this->actingAs(transitAdmin())
        ->postJson('/api/v1/admin/routes/import-preview', [])
        ->assertStatus(422);
});

test('import-preview rejects an invalid maps url', function () {
    $this->actingAs(transitAdmin())
        ->postJson('/api/v1/admin/routes/import-preview', ['url' => 'https://google.com/maps?q=damascus'])
        ->assertStatus(422)
        ->assertJsonPath('message', 'رابط غير صالح — انسخ رابط My Maps الذي يحتوي mid= (مثال: google.com/maps/d/...?mid=...)');
});

test('import-preview parses a faked google kml response', function () {
    seedTransitCity();
    Http::fake(['https://www.google.com/maps/d/kml*' => Http::response(singleKml(), 200)]);

    $this->actingAs(transitAdmin())
        ->postJson('/api/v1/admin/routes/import-preview', [
            'url' => 'https://www.google.com/maps/d/u/0/edit?mid=1eldQB_s9AbKbJ2-4NITj3DqkzDKQtL4&usp=sharing',
        ])
        ->assertOk()
        ->assertJsonPath('mid', '1eldQB_s9AbKbJ2-4NITj3DqkzDKQtL4')
        ->assertJsonPath('routes.0.name_ar', 'خط وعر قصر عدلي (المحكمة) - غوطة - السوق')
        ->assertJsonPath('routes.0.price', 30)
        ->assertJsonPath('routes.0.stop_count', 3)
        ->assertJsonPath('routes.0.suggested_city_id', 'homs');
});

test('import-preview surfaces a private-map error as 422', function () {
    Http::fake(['https://www.google.com/maps/d/kml*' => Http::response('<html>login</html>', 200)]);

    $this->actingAs(transitAdmin())
        ->postJson('/api/v1/admin/routes/import-preview', ['mid' => '1eldQB_s9AbKbJ2-4NITj3DqkzDKQtL4'])
        ->assertStatus(422)
        ->assertJsonStructure(['message']);
});

test('import-preview accepts a kml file upload', function () {
    seedTransitCity();
    $file = new UploadedFile(
        base_path('tests/Fixtures/transit-single.kml'),
        'homs-line.kml',
        'application/vnd.google-earth.kml+xml',
        null,
        true
    );

    $this->actingAs(transitAdmin())
        ->post('/api/v1/admin/routes/import-preview', ['file' => $file])
        ->assertOk()
        ->assertJsonPath('routes.0.stop_count', 3);
});

// ─── Publish endpoint ───────────────────────────────────────────────────

test('import-publish rejects guests and non-admins', function () {
    $user = User::factory()->create(['role' => 'user']);
    $payload = ['city_id' => 'homs', 'name_ar' => 'x', 'geojson' => ['type' => 'FeatureCollection', 'features' => []]];

    $this->postJson('/api/v1/admin/routes/import-publish', $payload)->assertUnauthorized();
    $this->actingAs($user)->postJson('/api/v1/admin/routes/import-publish', $payload)->assertForbidden();
});

test('import-publish creates a pending draft reusing the studio contract', function () {
    seedTransitCity();

    $geojson = [
        'type' => 'FeatureCollection',
        'features' => [
            ['type' => 'Feature', 'properties' => [], 'geometry' => ['type' => 'LineString', 'coordinates' => [[36.66, 34.73], [36.68, 34.735], [36.71, 34.732]]]],
            ['type' => 'Feature', 'properties' => ['nameAr' => 'موقف 1'], 'geometry' => ['type' => 'Point', 'coordinates' => [36.66, 34.73]]],
        ],
    ];

    $res = $this->actingAs(transitAdmin())
        ->postJson('/api/v1/admin/routes/import-publish', [
            'city_id' => 'homs',
            'name_ar' => 'خط مستورد تجريبي',
            'price' => 30,
            'color_index' => 2,
            'notes' => 'من الاستيراد',
            'geojson' => $geojson,
            'mode' => 'draft',
            'source_mid' => '1eldQB_s9AbKbJ2-4NITj3DqkzDKQtL4',
        ])
        ->assertCreated()
        ->assertJsonPath('draft_id', fn ($id) => $id > 0);

    $this->assertDatabaseHas('route_drafts', [
        'id' => $res->json('draft_id'),
        'city_id' => 'homs',
        'name_ar' => 'خط مستورد تجريبي',
        'status' => 'pending',
    ]);
});

test('import-publish rejects degenerate geometry', function () {
    seedTransitCity();

    $this->actingAs(transitAdmin())
        ->postJson('/api/v1/admin/routes/import-publish', [
            'city_id' => 'homs',
            'name_ar' => 'خط ناقص',
            'geojson' => [
                'type' => 'FeatureCollection',
                'features' => [
                    ['type' => 'Feature', 'properties' => [], 'geometry' => ['type' => 'LineString', 'coordinates' => [[36.66, 34.73]]]],
                ],
            ],
        ])
        ->assertStatus(422);
});
