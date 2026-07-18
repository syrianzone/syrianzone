<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('place_photos', function (Blueprint $table): void {
            $table->timestamp('reprocess_requested_at')->nullable()->index();
            $table->timestamp('reprocess_available_at')->nullable()->index();
            $table->unsignedInteger('reprocess_attempts')->default(0);
            $table->text('reprocess_last_error')->nullable();
        });

        $now = now();
        DB::table('place_photos')->update([
            'reprocess_requested_at' => $now,
            'reprocess_available_at' => $now,
        ]);
    }

    public function down(): void
    {
        Schema::table('place_photos', function (Blueprint $table): void {
            $table->dropIndex(['reprocess_requested_at']);
            $table->dropIndex(['reprocess_available_at']);
            $table->dropColumn([
                'reprocess_requested_at',
                'reprocess_available_at',
                'reprocess_attempts',
                'reprocess_last_error',
            ]);
        });
    }
};
