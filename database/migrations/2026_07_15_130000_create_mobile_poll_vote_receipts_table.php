<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mobile_poll_vote_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('poll_id')->constrained()->cascadeOnDelete();
            $table->date('vote_day');
            $table->string('installation_hash', 64);
            $table->string('ip_hash', 64);
            $table->timestamps();

            $table->index(
                ['poll_id', 'vote_day', 'ip_hash'],
                'mobile_poll_vote_receipts_network_lookup',
            );

            $table->unique(
                ['poll_id', 'vote_day', 'installation_hash'],
                'mobile_poll_vote_receipts_unique_ballot',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mobile_poll_vote_receipts');
    }
};
