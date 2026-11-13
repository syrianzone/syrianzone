<?php

use App\Support\SearchFold;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The stored Arabic fold behind every `LIKE` search.
 *
 * `GlobalSearchController`, the transit search and the Mishwar places list used
 * to compare the query against the raw column, so «احمد» never found «أحمد» and
 * «صلاه» never found «صلاة» on the server (the browser already folded both
 * sides). Comparing folded to folded is what closes that gap; storing the fold
 * keeps the comparison a plain column read instead of a `REPLACE()` chain that
 * no index can answer.
 *
 * A `*_fold` column mirrors the type of the column it folds: `string(255)` for
 * a name, `text` for a description, so a long description cannot overflow. The
 * backfill runs here — one statement per row group, in chunks — because both
 * tables are already populated in production and a `CREATE INDEX` cannot
 * express a fold. `search:backfill-fold` runs the same code after a rule change.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->string('name_ar_fold', 255)->nullable()->after('name_ar');
            $table->index('name_ar_fold', 'routes_name_ar_fold_index');
        });

        Schema::table('stops', function (Blueprint $table) {
            $table->string('name_ar_fold', 255)->nullable()->after('name_ar');
            $table->index('name_ar_fold', 'stops_name_ar_fold_index');
        });

        Schema::table('places', function (Blueprint $table) {
            $table->string('name_fold', 255)->nullable()->after('name');
            $table->index('name_fold', 'places_name_fold_index');
            $table->text('description_fold')->nullable()->after('description');
        });

        Schema::table('phonebook_entries', function (Blueprint $table) {
            $table->string('name_ar_fold', 255)->nullable()->after('name_ar');
            $table->index('name_ar_fold', 'phonebook_entries_name_ar_fold_index');
        });

        Schema::table('official_entities', function (Blueprint $table) {
            $table->string('name_ar_fold', 255)->nullable()->after('name_ar');
            $table->index('name_ar_fold', 'official_entities_name_ar_fold_index');
            $table->text('description_ar_fold')->nullable()->after('description_ar');
        });

        Schema::table('gov_apps', function (Blueprint $table) {
            $table->string('name_ar_fold', 255)->nullable()->after('name_ar');
            $table->index('name_ar_fold', 'gov_apps_name_ar_fold_index');
            $table->text('description_ar_fold')->nullable()->after('description_ar');
        });

        SearchFold::backfill();
    }

    public function down(): void
    {
        // The wide description columns carry no index of their own: a B-tree
        // cannot serve a `%needle%` match, and MySQL needs a prefix length for
        // one on a TEXT column, which SQLite does not have.
        Schema::table('gov_apps', function (Blueprint $table) {
            $table->dropIndex('gov_apps_name_ar_fold_index');
            $table->dropColumn(['name_ar_fold', 'description_ar_fold']);
        });

        Schema::table('official_entities', function (Blueprint $table) {
            $table->dropIndex('official_entities_name_ar_fold_index');
            $table->dropColumn(['name_ar_fold', 'description_ar_fold']);
        });

        Schema::table('phonebook_entries', function (Blueprint $table) {
            $table->dropIndex('phonebook_entries_name_ar_fold_index');
            $table->dropColumn('name_ar_fold');
        });

        Schema::table('places', function (Blueprint $table) {
            $table->dropIndex('places_name_fold_index');
            $table->dropColumn(['name_fold', 'description_fold']);
        });

        Schema::table('stops', function (Blueprint $table) {
            $table->dropIndex('stops_name_ar_fold_index');
            $table->dropColumn('name_ar_fold');
        });

        Schema::table('routes', function (Blueprint $table) {
            $table->dropIndex('routes_name_ar_fold_index');
            $table->dropColumn('name_ar_fold');
        });
    }
};
