<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void
  {
    Schema::table('compass_results', function (Blueprint $table) {
      // Anonymous-stats opt-in. Rows counted in statistics must have this true.
      $table->boolean('stats_consent')->default(false)->after('answered');
      // Distinguishes an account-saved run from an anonymous stats submission
      // (user_id = null && stats_consent = true).
      $table->index(['stats_consent', 'created_at']);
    });
  }

  public function down(): void
  {
    Schema::table('compass_results', function (Blueprint $table) {
      $table->dropIndex(['stats_consent', 'created_at']);
      $table->dropColumn('stats_consent');
    });
  }
};
