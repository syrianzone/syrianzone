<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Promises tracker (عداد الوعود). See docs/specs/promises.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promise_sectors', function (Blueprint $table) {
            $table->string('id', 32)->primary();
            $table->string('label');
            $table->string('icon', 64)->nullable();
            $table->integer('order_column')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('promise_speakers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('title')->nullable();
            $table->string('institution_id')->nullable();
            $table->string('image_url', 2048)->nullable();
            $table->string('x_handle', 64)->nullable();
            // Links to people already in the system. Unique so the same
            // tier-list or House record can never become two speakers.
            $table->uuid('candidate_id')->nullable()->unique();
            $table->string('official_entity_id')->nullable()->unique();
            $table->unsignedBigInteger('house_member_id')->nullable()->unique();
            $table->string('status', 16)->default('approved')->index();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->foreign('institution_id')->references('id')->on('official_entities')->nullOnDelete();
            $table->foreign('candidate_id')->references('id')->on('candidates')->nullOnDelete();
            $table->foreign('official_entity_id')->references('id')->on('official_entities')->nullOnDelete();
            $table->foreign('house_member_id')->references('id')->on('house_members_2026')->nullOnDelete();
        });

        Schema::create('promises', function (Blueprint $table) {
            $table->uuid('id')->primary();
            // Public id (/promises/42). Assigned on publish so rejected
            // suggestions never leave gaps in the public numbering.
            $table->unsignedInteger('number')->nullable()->unique();
            $table->string('title', 200);
            $table->text('summary')->nullable();
            $table->text('quote');
            $table->boolean('quote_is_verbatim')->default(true);
            $table->foreignUuid('speaker_id')->constrained('promise_speakers')->restrictOnDelete();
            $table->string('speaker_title')->nullable();
            $table->string('institution_id')->nullable();
            $table->string('sector_id', 32)->nullable();
            $table->boolean('is_national')->default(true);
            $table->date('statement_date');
            $table->string('statement_venue', 32);
            $table->string('deadline_wording')->nullable();
            $table->date('deadline_date')->nullable()->index();
            $table->text('deadline_reasoning')->nullable();
            $table->decimal('target_value', 18, 2)->nullable();
            $table->string('target_unit', 64)->nullable();
            $table->decimal('baseline_value', 18, 2)->nullable();
            $table->string('baseline_note')->nullable();
            $table->string('status', 24)->default('pending')->index();
            $table->date('resolved_at')->nullable();
            $table->uuid('restates_promise_id')->nullable();
            $table->string('review_status', 16)->default('pending')->index();
            $table->string('origin', 16)->default('editor');
            $table->text('submitter_note')->nullable();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('institution_id')->references('id')->on('official_entities')->nullOnDelete();
            $table->foreign('sector_id')->references('id')->on('promise_sectors')->nullOnDelete();
            $table->foreign('restates_promise_id')->references('id')->on('promises')->nullOnDelete();
            $table->index(['review_status', 'status']);
        });

        Schema::create('promise_governorate', function (Blueprint $table) {
            $table->foreignUuid('promise_id')->constrained('promises')->cascadeOnDelete();
            $table->string('governorate', 32)->index();
            $table->primary(['promise_id', 'governorate']);
        });

        Schema::create('promise_tags', function (Blueprint $table) {
            $table->foreignUuid('promise_id')->constrained('promises')->cascadeOnDelete();
            $table->string('tag', 64)->index();
            $table->primary(['promise_id', 'tag']);
        });

        Schema::create('promise_sources', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('promise_id')->constrained('promises')->cascadeOnDelete();
            $table->string('url', 2048);
            $table->string('outlet')->nullable();
            $table->string('type', 32);
            $table->date('published_date')->nullable();
            $table->string('language', 8)->nullable();
            $table->string('archive_url', 2048)->nullable();
            $table->string('screenshot_url', 2048)->nullable();
            $table->string('video_timestamp', 16)->nullable();
            $table->boolean('is_primary')->default(false);
            $table->integer('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('promise_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('promise_id')->constrained('promises')->cascadeOnDelete();
            $table->string('type', 24);
            $table->date('happened_on');
            $table->text('body')->nullable();
            $table->string('status_from', 24)->nullable();
            $table->string('status_to', 24)->nullable();
            $table->decimal('value', 18, 2)->nullable();
            $table->string('source_url', 2048)->nullable();
            $table->string('archive_url', 2048)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['promise_id', 'happened_on']);
        });

        Schema::create('promise_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('promise_id')->constrained('promises')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('kind', 16);
            $table->text('body');
            $table->string('source_url', 2048)->nullable();
            $table->string('status', 16)->default('pending')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('resolution_note')->nullable();
            $table->timestamps();
        });

        Schema::create('promise_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('promise_id')->constrained('promises')->cascadeOnDelete();
            $table->string('voter_key', 64);
            $table->string('ip_hash', 64)->nullable();
            $table->boolean('believes');
            $table->timestamps();
            $table->unique(['promise_id', 'voter_key']);
        });

        $now = now();
        $sectors = [
            ['electricity', 'الكهرباء والطاقة', 'zap'],
            ['salaries', 'الرواتب والأجور', 'wallet'],
            ['prices', 'الأسعار والمعيشة', 'shopping-cart'],
            ['housing', 'السكن وإعادة الإعمار', 'house'],
            ['services', 'الخدمات والمياه', 'droplets'],
            ['transport', 'النقل والطرق', 'bus'],
            ['economy', 'الاقتصاد والمصارف', 'landmark'],
            ['telecom', 'الاتصالات والإنترنت', 'wifi'],
            ['health', 'الصحة', 'heart-pulse'],
            ['education', 'التعليم', 'graduation-cap'],
            ['governance', 'الحوكمة والانتخابات', 'scale'],
            ['returns', 'عودة اللاجئين والنازحين', 'users'],
            ['other', 'أخرى', 'circle-ellipsis'],
        ];
        DB::table('promise_sectors')->insert(array_map(fn ($s, $i) => [
            'id' => $s[0],
            'label' => $s[1],
            'icon' => $s[2],
            'order_column' => $i,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ], $sectors, array_keys($sectors)));
    }

    public function down(): void
    {
        Schema::dropIfExists('promise_votes');
        Schema::dropIfExists('promise_reports');
        Schema::dropIfExists('promise_updates');
        Schema::dropIfExists('promise_sources');
        Schema::dropIfExists('promise_tags');
        Schema::dropIfExists('promise_governorate');
        Schema::dropIfExists('promises');
        Schema::dropIfExists('promise_speakers');
        Schema::dropIfExists('promise_sectors');
    }
};
