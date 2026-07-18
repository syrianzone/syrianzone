<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // A later migration records durable work after its schema prerequisites exist.
    }

    public function down(): void
    {
        // The later migration owns the durable work marker.
    }
};
