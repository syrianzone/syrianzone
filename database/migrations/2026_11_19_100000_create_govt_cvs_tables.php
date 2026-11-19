<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Government CVs & Tenure Tracker (السير الذاتية للمسؤولين).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('govt_office_slots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 160)->unique();
            $table->string('title_ar', 255);
            $table->string('title_ar_fold', 255)->nullable()->index();
            $table->string('institution_id', 255)->nullable()->index();
            $table->string('institution_name_ar', 255)->nullable();
            $table->string('tier', 32)->index();
            $table->boolean('is_single_seat')->default(true);
            $table->string('status', 24)->default('active')->index();
            $table->date('active_from')->nullable();
            $table->date('ended_at')->nullable();
            $table->text('lineage_note_ar')->nullable();
            $table->uuid('replaced_by_slot_id')->nullable();
            $table->timestamps();

            $table->foreign('institution_id')->references('id')->on('official_entities')->nullOnDelete();
        });

        Schema::create('govt_officials', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug', 160)->unique();
            $table->string('full_name_ar', 255);
            $table->string('display_name_ar', 255);
            $table->string('full_name_en', 255)->nullable();
            $table->string('honorific_ar', 100)->nullable();
            $table->string('full_name_ar_fold', 255)->nullable()->index();
            $table->string('display_name_ar_fold', 255)->nullable()->index();
            $table->text('bio_summary_ar')->nullable();
            $table->text('bio_summary_ar_fold')->nullable();
            $table->string('office_status', 32)->default('in_office')->index();
            $table->string('highest_tier', 32)->default('minister')->index();
            $table->smallInteger('birth_year')->nullable();
            $table->string('birth_place_ar', 255)->nullable();
            $table->string('gender', 16)->nullable();
            $table->json('languages')->nullable();
            $table->string('portrait_url', 500)->nullable();
            $table->string('cv_completeness', 24)->default('positions_only')->index();
            $table->date('first_seen_in_office_at')->nullable();
            $table->date('last_seen_in_office_at')->nullable();
            $table->uuid('candidate_id')->nullable()->unique();
            $table->uuid('promise_speaker_id')->nullable()->unique();
            $table->string('official_entity_id', 255)->nullable()->unique();
            $table->unsignedBigInteger('house_member_id')->nullable()->unique();
            $table->string('publish_status', 24)->default('draft')->index();
            $table->string('verification_level', 24)->default('editorial');
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->foreign('candidate_id')->references('id')->on('candidates')->nullOnDelete();
            $table->foreign('promise_speaker_id')->references('id')->on('promise_speakers')->nullOnDelete();
            $table->foreign('official_entity_id')->references('id')->on('official_entities')->nullOnDelete();
            $table->foreign('house_member_id')->references('id')->on('house_members_2026')->nullOnDelete();
            $table->index(['publish_status', 'office_status', 'highest_tier'], 'govt_officials_pub_status_tier_idx');
        });

        Schema::create('govt_official_aliases', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('official_id')->constrained('govt_officials')->cascadeOnDelete();
            $table->string('alias_ar', 255);
            $table->string('alias_ar_fold', 255)->nullable()->index();
            $table->string('alias_type', 32)->default('patronymic_short');
            $table->string('source_note', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('govt_tenures', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('official_id')->constrained('govt_officials')->cascadeOnDelete();
            $table->uuid('office_slot_id')->nullable()->index();
            $table->string('institution_id', 255)->nullable()->index();
            $table->string('institution_name_ar', 255)->nullable();
            $table->string('role_title_ar', 255);
            $table->string('role_title_ar_fold', 255)->nullable()->index();
            $table->string('tier', 32)->index();
            $table->string('government_phase', 32)->default('transitional_2025')->index();
            $table->string('status', 24)->default('current')->index();
            $table->date('started_at')->nullable()->index();
            $table->string('start_date_precision', 32)->default('exact');
            $table->string('start_decree_ref', 160)->nullable();
            $table->date('ended_at')->nullable()->index();
            $table->string('end_date_precision', 32)->nullable();
            $table->string('end_reason', 32)->nullable();
            $table->string('end_decree_ref', 160)->nullable();
            $table->date('first_operational_seen_at')->nullable();
            $table->date('last_operational_seen_at')->nullable();
            $table->unsignedInteger('operational_mentions_count')->default(0);
            $table->boolean('is_acting')->default(false);
            $table->text('notes_ar')->nullable();
            $table->timestamps();

            $table->foreign('office_slot_id')->references('id')->on('govt_office_slots')->nullOnDelete();
            $table->foreign('institution_id')->references('id')->on('official_entities')->nullOnDelete();
        });

        Schema::create('govt_cv_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('official_id')->constrained('govt_officials')->cascadeOnDelete();
            $table->string('section', 32)->index();
            $table->string('title_ar', 255);
            $table->string('organization_ar', 255)->nullable();
            $table->string('location_ar', 255)->nullable();
            $table->smallInteger('start_year')->nullable();
            $table->smallInteger('end_year')->nullable();
            $table->boolean('is_ongoing')->default(false);
            $table->text('details_ar')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('govt_evidence_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('official_id')->constrained('govt_officials')->cascadeOnDelete();
            $table->uuid('tenure_id')->nullable()->index();
            $table->string('evidence_type', 32)->index();
            $table->unsignedBigInteger('paperless_record_id')->nullable()->index();
            $table->string('paperless_channel_id', 100)->nullable();
            $table->unsignedBigInteger('paperless_message_id')->nullable();
            $table->string('chunk_type', 24)->nullable();
            $table->string('source_title_ar', 255);
            $table->string('source_channel_ar', 255)->nullable();
            $table->string('source_url', 500)->nullable();
            $table->date('published_date')->nullable();
            $table->text('excerpt_ar')->nullable();
            $table->timestamps();

            $table->foreign('tenure_id')->references('id')->on('govt_tenures')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('govt_evidence_links');
        Schema::dropIfExists('govt_cv_entries');
        Schema::dropIfExists('govt_tenures');
        Schema::dropIfExists('govt_official_aliases');
        Schema::dropIfExists('govt_officials');
        Schema::dropIfExists('govt_office_slots');
    }
};
