<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Append-only trail of every agent tool call.
     *
     * An agent acts with a credential a human cannot see the internals of, so
     * "who changed this place, and with what authority" has to be answerable
     * after the fact. user_id and token_id are nullable and unconstrained on
     * purpose: the row must survive the user or the token being deleted, which
     * is exactly when someone reaches for the audit log. token_name is
     * denormalised for the same reason.
     */
    public function up(): void
    {
        Schema::create('mcp_tool_calls', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')->nullable()->index();
            $table->foreignId('token_id')->nullable()->index();
            $table->string('token_name')->nullable();

            $table->string('tool')->index();
            $table->json('arguments')->nullable();

            $table->string('outcome')->index();
            $table->text('error')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();

            $table->string('ip', 45)->nullable();
            $table->string('user_agent')->nullable();

            $table->timestamp('created_at')->nullable()->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mcp_tool_calls');
    }
};
