<?php

namespace Tests\Feature;

use App\Models\Place;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PlacePhotoSortMigrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Artisan::call('migrate:fresh', ['--force' => true]);
    }

    protected function tearDown(): void
    {
        Artisan::call('migrate:fresh', ['--force' => true]);

        parent::tearDown();
    }

    public function test_it_normalizes_existing_sort_values_before_adding_the_unique_index(): void
    {
        $migration = require database_path('migrations/2026_07_18_000001_normalize_place_photo_sort_order.php');
        $migration->down();

        $place = Place::factory()->create();
        $ids = [
            $this->insertPhoto($place->id, 2, 'a'),
            $this->insertPhoto($place->id, 0, 'b'),
            $this->insertPhoto($place->id, 0, 'c'),
            $this->insertPhoto($place->id, 5, 'd'),
        ];

        $migration->up();

        $sorts = DB::table('place_photos')
            ->where('place_id', $place->id)
            ->pluck('sort', 'id');
        $this->assertSame(2, $sorts[$ids[0]]);
        $this->assertSame(0, $sorts[$ids[1]]);
        $this->assertSame(1, $sorts[$ids[2]]);
        $this->assertSame(3, $sorts[$ids[3]]);
        $this->assertTrue(Schema::hasIndex('place_photos', ['place_id', 'sort'], 'unique'));

        $otherPlace = Place::factory()->create();
        $this->insertPhoto($otherPlace->id, 0, 'other');

        try {
            $this->insertPhoto($place->id, 0, 'duplicate');
            $this->fail('Duplicate photo sort was accepted');
        } catch (QueryException) {
            $this->assertDatabaseCount('place_photos', 5);
        }
    }

    private function insertPhoto(int $placeId, int $sort, string $name): int
    {
        return DB::table('place_photos')->insertGetId([
            'place_id' => $placeId,
            'original_path' => "places/{$placeId}/{$name}.jpg",
            'display_path' => "places/{$placeId}/{$name}_display.webp",
            'thumb_path' => "places/{$placeId}/{$name}_thumb.webp",
            'sort' => $sort,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
