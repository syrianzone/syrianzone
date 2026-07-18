<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mobile_guess_who_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('credential_hash', 64)->unique();
            $table->uuid('room_code')->nullable()->index();
            $table->string('role', 20)->nullable();
            $table->unsignedInteger('generation')->default(0);
            $table->timestamp('expires_at')->index();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mobile_guess_who_sessions');
    }
};
