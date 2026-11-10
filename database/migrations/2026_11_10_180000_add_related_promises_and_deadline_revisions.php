<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promises', function (Blueprint $table) {
            $table->date('original_deadline_date')->nullable()->after('deadline_reasoning');
            $table->string('original_deadline_wording')->nullable()->after('original_deadline_date');
            $table->unsignedTinyInteger('postponed_count')->default(0)->after('original_deadline_wording');
        });

        Schema::create('promise_relations', function (Blueprint $table) {
            $table->foreignUuid('promise_id')->constrained('promises')->cascadeOnDelete();
            $table->foreignUuid('related_promise_id')->constrained('promises')->cascadeOnDelete();
            $table->string('relation_type', 24)->default('related');
            $table->primary(['promise_id', 'related_promise_id']);
            $table->index('related_promise_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promise_relations');

        Schema::table('promises', function (Blueprint $table) {
            $table->dropColumn([
                'original_deadline_date',
                'original_deadline_wording',
                'postponed_count',
            ]);
        });
    }
};
