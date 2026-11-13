<?php

use App\Models\GovApp;
use App\Models\OfficialEntity;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Models\Place;
use App\Models\Stop;
use App\Support\ArabicSearch;
use App\Support\SearchFold;
use Illuminate\Support\Facades\DB;

/*
|--------------------------------------------------------------------------
| Server-side Arabic search
|--------------------------------------------------------------------------
|
| The lists used to compare the query against the raw column, so «احمد» found
| nothing named «أحمد» while the browser's own index did find it. Each searched
| Arabic column now stores its fold (`SearchFold::COLUMNS`) and the query is
| folded the same way: `resources/data/search-fold.json` is the case table both
| languages assert.
|
*/

test('global search finds a hamza alef written without one', function () {
    Place::factory()->approved()->create(['name' => 'أحمد الشامي']);

    $this->getJson('/api/v1/search/global?q=احمد')
        ->assertOk()
        ->assertJsonPath('places.0.name', 'أحمد الشامي');
});

test('global search finds a ta marbuta written as ha', function () {
    Place::factory()->approved()->create(['name' => 'صلاة الجمعة']);

    $this->getJson('/api/v1/search/global?q=صلاه')
        ->assertOk()
        ->assertJsonPath('places.0.name', 'صلاة الجمعة');
});

test('global search folds both waw hamza spellings of one word', function () {
    GovApp::factory()->create(['name_ar' => 'مؤسسة المياه', 'name' => 'Water Utility']);

    foreach (['مؤسسة', 'موسسه', 'مؤسسه'] as $typed) {
        $response = $this->getJson('/api/v1/search/global?q='.urlencode($typed))->assertOk();

        expect($response->json('govapps.0.nameAr'))->toBe('مؤسسة المياه', "«{$typed}» must find «مؤسسة المياه»");
    }
});

test('an unfolded query still finds its row', function () {
    PhonebookEntry::create([
        'id' => 'sarc-damascus',
        'category_id' => PhonebookCategory::create([
            'id' => 'emergency',
            'label_ar' => 'طوارئ',
            'label_en' => 'Emergency',
        ])->id,
        'name_ar' => 'الهلال الأحمر',
        'name_en' => 'Red Crescent',
        'number' => '133',
        'is_active' => true,
    ]);

    foreach (['الهلال', 'هلال'] as $typed) {
        $this->getJson('/api/v1/search/global?q='.urlencode($typed))
            ->assertOk()
            ->assertJsonPath('phonebook.0.nameAr', 'الهلال الأحمر');
    }

    // An English name and a number are matched raw, as before.
    $this->getJson('/api/v1/search/global?q=Crescent')
        ->assertOk()
        ->assertJsonPath('phonebook.0.id', 'sarc-damascus');

    $this->getJson('/api/v1/search/global?q=133')
        ->assertOk()
        ->assertJsonPath('phonebook.0.id', 'sarc-damascus');
});

test('the description is searched folded too', function () {
    OfficialEntity::factory()->create([
        'name_ar' => 'وزارة النقل',
        'name' => 'Ministry of Transport',
        'description_ar' => 'تُشرف على مؤسسة الخطوط الحديدية',
    ]);

    $this->getJson('/api/v1/search/global?q='.urlencode('مؤسسه'))
        ->assertOk()
        ->assertJsonPath('officials.0.nameAr', 'وزارة النقل');
});

test('a saved row is searchable immediately', function () {
    $place = Place::factory()->approved()->create(['name' => 'مقهى الروضة', 'description' => 'شارع بغداد']);

    // Written by the trait on save, without the caller knowing the column.
    expect($place->fresh()->name_fold)->toBe('مقهي الروضه')
        ->and($place->fresh()->description_fold)->toBe('شارع بغداد');

    $this->getJson('/api/v1/places?q='.urlencode('مقهي'))
        ->assertOk()
        ->assertJsonPath('data.0.name', 'مقهى الروضة');
});

test('transit search folds route and stop names', function () {
    seedCity('damascus', ['name_ar' => 'دمشق']);

    $route = transitRoute('route-test', 'damascus', ['name_ar' => 'خط أحمد']);

    if (DB::connection()->getDriverName() === 'sqlite') {
        DB::connection()->getPdo()->sqliteCreateFunction('ST_AsGeoJSON', fn ($value) => $value, 1);
    }

    Stop::create([
        'id' => 'stop-test',
        'city_id' => 'damascus',
        'name_ar' => 'مؤسسة الكهرباء',
        'geometry' => spatialValue(['type' => 'Point', 'coordinates' => [36.29, 33.51]]),
    ]);

    $response = $this->getJson('/api/v1/transit/search?q='.urlencode('احمد'))->assertOk();
    expect($response->json('routes.0.id'))->toBe($route->id);

    $response = $this->getJson('/api/v1/transit/search?q='.urlencode('موسسه'))->assertOk();
    expect($response->json('stops.0.id'))->toBe('stop-test');
});

test('the backfill folds rows written before the columns existed', function () {
    $place = Place::factory()->approved()->create(['name' => 'صلاة الجمعة', 'description' => 'وصف']);

    // Rows that predate the migration: the fold columns are empty and nothing
    // would ever rewrite them, because no save happens.
    Place::whereKey($place->id)->update(['name_fold' => null, 'description_fold' => null]);

    $this->getJson('/api/v1/search/global?q='.urlencode('صلاه'))
        ->assertOk()
        ->assertJsonPath('places', []);

    expect(SearchFold::backfill('places'))->toBe(1);

    $this->getJson('/api/v1/search/global?q='.urlencode('صلاه'))
        ->assertOk()
        ->assertJsonPath('places.0.name', 'صلاة الجمعة');

    // Idempotent: a second run re-folds nothing.
    expect(SearchFold::backfill('places'))->toBe(0)
        ->and(ArabicSearch::fold('صلاة الجمعة'))->toBe('صلاه الجمعه');
});

test('the backfill command repairs a stale fold', function () {
    $place = Place::factory()->approved()->create(['name' => 'مقهى الروضة']);
    Place::whereKey($place->id)->update(['name_fold' => 'قديم']);

    $this->artisan('search:backfill-fold', ['--table' => 'places'])
        ->expectsOutput('1 row(s) re-folded.')
        ->assertSuccessful();

    expect($place->fresh()->name_fold)->toBe('مقهي الروضه');

    $this->artisan('search:backfill-fold', ['--table' => 'no_such_table'])
        ->assertFailed();
});
