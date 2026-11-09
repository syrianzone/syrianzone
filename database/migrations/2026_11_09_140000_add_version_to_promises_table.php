<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Optimistic locking for promise edits: every save of a promise's own fields
 * bumps `version`, and a save that names the version it read is refused once
 * the promise has moved on. See PromiseEditor::saveIfUnchanged.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promises', function (Blueprint $table) {
            $table->unsignedInteger('version')->default(0)->after('review_status');
        });
    }

    public function down(): void
    {
        Schema::table('promises', function (Blueprint $table) {
            $table->dropColumn('version');
        });
    }
};
