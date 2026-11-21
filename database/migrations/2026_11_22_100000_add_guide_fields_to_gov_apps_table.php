<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gov_apps', function (Blueprint $table) {
            if (! Schema::hasColumn('gov_apps', 'official_entity_id')) {
                $table->string('official_entity_id', 128)->nullable()->after('description_ar')->index();
            }
            if (! Schema::hasColumn('gov_apps', 'overview_ar')) {
                $table->text('overview_ar')->nullable()->after('official_entity_id');
            }
            if (! Schema::hasColumn('gov_apps', 'features')) {
                $table->json('features')->nullable()->after('overview_ar');
            }
            if (! Schema::hasColumn('gov_apps', 'requirements')) {
                $table->json('requirements')->nullable()->after('features');
            }
            if (! Schema::hasColumn('gov_apps', 'faqs')) {
                $table->json('faqs')->nullable()->after('requirements');
            }
            if (! Schema::hasColumn('gov_apps', 'verified_at')) {
                $table->date('verified_at')->nullable()->after('faqs');
            }
        });
    }

    public function down(): void
    {
        Schema::table('gov_apps', function (Blueprint $table) {
            $cols = array_values(array_filter(
                ['official_entity_id', 'overview_ar', 'features', 'requirements', 'faqs', 'verified_at'],
                fn (string $col) => Schema::hasColumn('gov_apps', $col),
            ));
            if ($cols !== []) {
                $table->dropColumn($cols);
            }
        });
    }
};
