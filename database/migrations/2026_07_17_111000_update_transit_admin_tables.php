<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->string('status', 50)->default('published')->change();
        });

        Schema::create('transit_route_logs', function (Blueprint $table) {
            $table->id();
            $table->string('route_id')->nullable();
            $table->string('action'); // approved, disapproved, restored, hidden, combined, split, moved
            $table->text('description');
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transit_route_logs');

        Schema::table('routes', function (Blueprint $table) {
            $table->enum('status', ['draft', 'published'])->default('published')->change();
        });
    }
};
