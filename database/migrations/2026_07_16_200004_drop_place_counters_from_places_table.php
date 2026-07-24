<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('places')) {
            return;
        }

        $columns = array_values(array_filter(
            ['likes_count', 'comments_count'],
            fn (string $column): bool => Schema::hasColumn('places', $column),
        ));
        if ($columns === []) {
            return;
        }

        Schema::table('places', fn (Blueprint $table) => $table->dropColumn($columns));
    }

    public function down(): void
    {
        if (! Schema::hasTable('places')) {
            return;
        }

        $addLikes = ! Schema::hasColumn('places', 'likes_count');
        $addComments = ! Schema::hasColumn('places', 'comments_count');
        if (! $addLikes && ! $addComments) {
            return;
        }

        Schema::table('places', function (Blueprint $table) use ($addComments, $addLikes): void {
            if ($addLikes) {
                $table->unsignedInteger('likes_count')->default(0)->after('rejection_reason');
            }
            if ($addComments) {
                $table->unsignedInteger('comments_count')->default(0)->after('rejection_reason');
            }
        });
    }
};
