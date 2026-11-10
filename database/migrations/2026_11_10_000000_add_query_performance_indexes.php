<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes for the read paths that were scanning or filesorting, each named
 * after the query it serves. Measured against MySQL 8.4; see the notes per
 * index.
 *
 * Deliberately absent: daily_scores (poll_id, day). It makes "today's scores"
 * an index lookup, but the optimizer then prefers it for the leaderboard's
 * whole-poll reads as well, where it is slower than the primary key (about
 * twice as slow when measured), and it would be maintained on every vote.
 */
return new class extends Migration
{
    public function up(): void
    {
        // The places list: approved, newest first, or most saved first. Only
        // (status, category) existed, so both orderings sorted every approved
        // place to return twenty.
        Schema::table('places', function (Blueprint $table) {
            $table->index(['status', 'created_at'], 'places_status_created_index');
            $table->index(['status', 'saves_count', 'created_at'], 'places_status_saves_created_index');
        });

        // Cover photo of a place (lowest sort) and the ordered gallery.
        Schema::table('place_photos', function (Blueprint $table) {
            $table->index(['place_id', 'sort'], 'place_photos_place_sort_index');
        });

        // "My saved places", newest save first.
        Schema::table('place_saves', function (Blueprint $table) {
            $table->index(['user_id', 'created_at'], 'place_saves_user_created_index');
        });

        // The route history list (newest first) and one route's history.
        // route_id has no foreign key, so it had no index at all.
        Schema::table('transit_route_logs', function (Blueprint $table) {
            $table->index('created_at', 'transit_route_logs_created_index');
            $table->index(['route_id', 'created_at'], 'transit_route_logs_route_created_index');
        });

        // The moderation queue (newest first) and a contributor's own drafts.
        Schema::table('route_drafts', function (Blueprint $table) {
            $table->index('created_at', 'route_drafts_created_index');
            $table->index(['user_id', 'created_at'], 'route_drafts_user_created_index');
        });

        // The compass statistics count the anonymous, consented runs on every
        // rebuild to check their running tally. This answers it from the index
        // alone instead of reading every anonymous row.
        Schema::table('compass_results', function (Blueprint $table) {
            $table->index(['user_id', 'stats_consent'], 'compass_results_user_consent_index');
        });

        // guesswho:prune deletes rooms by age every day.
        Schema::table('guess_who_games', function (Blueprint $table) {
            $table->index('updated_at', 'guess_who_games_updated_index');
        });

        $this->giveStopsASpatialReference();
    }

    /**
     * MySQL ignores a spatial index on a column that has no SRID attribute, so
     * the index added in 2026_05_26 was never used. Stops are always written
     * with ST_GeomFromGeoJSON (SRID 4326); declaring that on the column is what
     * lets "stops near me" use the index.
     *
     * MySQL only: MariaDB spells this differently and SQLite has no spatial
     * types. Skipped, loudly, if any stored point is not SRID 4326, because
     * the ALTER would fail and take the deploy with it.
     */
    private function giveStopsASpatialReference(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        if (DB::table('stops')->whereRaw('ST_SRID(geometry) <> 4326')->exists()) {
            logger()->warning('stops.geometry holds points that are not SRID 4326; spatial index left unusable.');

            return;
        }

        $hasIndex = collect(Schema::getIndexes('stops'))->contains('name', 'stops_geometry_spatialindex');

        if ($hasIndex) {
            DB::statement('ALTER TABLE stops DROP INDEX stops_geometry_spatialindex');
        }
        DB::statement('ALTER TABLE stops MODIFY geometry POINT NOT NULL SRID 4326');
        DB::statement('ALTER TABLE stops ADD SPATIAL INDEX stops_geometry_spatialindex (geometry)');
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql'
            && collect(Schema::getIndexes('stops'))->contains('name', 'stops_geometry_spatialindex')) {
            DB::statement('ALTER TABLE stops DROP INDEX stops_geometry_spatialindex');
            DB::statement('ALTER TABLE stops MODIFY geometry POINT NOT NULL');
            DB::statement('ALTER TABLE stops ADD SPATIAL INDEX stops_geometry_spatialindex (geometry)');
        }

        // InnoDB silently drops the index it generated for a foreign key once
        // another index can enforce it, which the composites above could. Put
        // the single-column one back first or the composite cannot be dropped.
        $restoreForeignKeyIndex = in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true);
        $restore = function (string $table, string $column) use ($restoreForeignKeyIndex) {
            $name = "{$table}_{$column}_foreign";
            if ($restoreForeignKeyIndex && ! collect(Schema::getIndexes($table))->contains('name', $name)) {
                Schema::table($table, fn (Blueprint $blueprint) => $blueprint->index($column, $name));
            }
        };

        Schema::table('guess_who_games', fn (Blueprint $table) => $table->dropIndex('guess_who_games_updated_index'));
        Schema::table('compass_results', fn (Blueprint $table) => $table->dropIndex('compass_results_user_consent_index'));
        $restore('route_drafts', 'user_id');
        Schema::table('route_drafts', function (Blueprint $table) {
            $table->dropIndex('route_drafts_user_created_index');
            $table->dropIndex('route_drafts_created_index');
        });
        Schema::table('transit_route_logs', function (Blueprint $table) {
            $table->dropIndex('transit_route_logs_route_created_index');
            $table->dropIndex('transit_route_logs_created_index');
        });
        $restore('place_saves', 'user_id');
        Schema::table('place_saves', fn (Blueprint $table) => $table->dropIndex('place_saves_user_created_index'));
        $restore('place_photos', 'place_id');
        Schema::table('place_photos', fn (Blueprint $table) => $table->dropIndex('place_photos_place_sort_index'));
        Schema::table('places', function (Blueprint $table) {
            $table->dropIndex('places_status_saves_created_index');
            $table->dropIndex('places_status_created_index');
        });
    }
};
