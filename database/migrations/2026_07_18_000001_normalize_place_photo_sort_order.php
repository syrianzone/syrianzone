<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const MAX_PHOTOS_PER_PLACE = 65_536;

    public function up(): void
    {
        if (Schema::hasIndex('place_photos', ['place_id', 'sort'], 'unique')) {
            return;
        }

        DB::transaction(function () {
            $placeIds = DB::table('place_photos')
                ->select('place_id')
                ->distinct()
                ->orderBy('place_id')
                ->pluck('place_id');

            foreach ($placeIds as $placeId) {
                $photoIds = DB::table('place_photos')
                    ->where('place_id', $placeId)
                    ->orderBy('sort')
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->pluck('id');

                if ($photoIds->count() > self::MAX_PHOTOS_PER_PLACE) {
                    throw new RuntimeException("Place {$placeId} has too many photos to normalize");
                }

                foreach ($photoIds as $sort => $photoId) {
                    DB::table('place_photos')->where('id', $photoId)->update(['sort' => $sort]);
                }
            }
        });

        Schema::table('place_photos', function (Blueprint $table) {
            $table->unique(['place_id', 'sort']);
        });
    }

    public function down(): void
    {
        if (! Schema::hasIndex('place_photos', ['place_id', 'sort'], 'unique')) {
            return;
        }

        // MySQL may use the composite unique index for the place foreign key.
        if (! Schema::hasIndex('place_photos', ['place_id'])) {
            Schema::table('place_photos', function (Blueprint $table) {
                $table->index('place_id');
            });
        }

        Schema::table('place_photos', function (Blueprint $table) {
            $table->dropUnique(['place_id', 'sort']);
        });
    }
};
