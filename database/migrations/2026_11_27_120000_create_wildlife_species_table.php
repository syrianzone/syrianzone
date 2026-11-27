<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The wildlife guide's species, editable without a pull request
 * (docs/modules/wildlife.md). Each row holds the record in the shape of
 * resources/data/wildlife.json twice over: `record` is what the public pages
 * show, `draft` is an edit waiting for someone with `wildlife.publish`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wildlife_species', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 80)->unique();
            $table->unsignedInteger('position')->default(0)->index();
            $table->json('record')->nullable();
            $table->json('draft')->nullable();
            $table->boolean('is_hidden')->default(false);
            $table->unsignedInteger('version')->default(1);
            $table->foreignId('draft_updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('draft_updated_at')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wildlife_species');
    }
};
