<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unique('google_id', 'users_google_id_unique');
        });

        Schema::create('mobile_auth_codes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->char('oauth_state_hash', 64)->unique();
            $table->text('app_state');
            $table->text('redirect_uri');
            $table->string('code_challenge', 128);
            $table->char('exchange_code_hash', 64)->nullable()->unique();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->timestamp('expires_at')->index();
            $table->timestamp('authorized_at')->nullable();
            $table->timestamp('exchange_expires_at')->nullable()->index();
            $table->timestamp('exchanged_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mobile_auth_codes');

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_google_id_unique');
        });
    }
};
