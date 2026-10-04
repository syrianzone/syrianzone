<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void
  {
    // Admin-managed compass roster. Replaces the compiled figures.ts as the
    // source the matcher runs against: the client is handed the enabled rows.
    Schema::create('compass_figures', function (Blueprint $table) {
      $table->id();
      $table->string('name')->unique();
      $table->string('category', 32);                 // founder|baath|islam|civ|kurd|minority|current
      $table->string('align', 64)->default('neutral'); // foreign alignment blocs, e.g. "west/neutral"
      $table->json('positions');                       // {axisId: number|null}
      $table->string('image_path')->nullable();        // storage key (R2 or public)
      $table->string('image_url', 2048)->nullable();   // resolved URL the client renders
      $table->boolean('enabled')->default(false);
      $table->unsignedInteger('sort_order')->default(0);
      $table->timestamps();

      $table->index(['enabled', 'sort_order']);
    });

    // Seed the built-in roster as DISABLED. Doing it in the migration (rather
    // than a seeder) guarantees the rows exist after any `migrate`, including a
    // fresh test database. Enabling them is an explicit operator action.
    $seed = require database_path('seeders/data/compass_figures.php');
    $now = now();
    $rows = [];
    foreach ($seed as $i => $figure) {
      $rows[] = [
        'name' => $figure['name'],
        'category' => $figure['category'],
        'align' => $figure['align'],
        'positions' => json_encode($figure['positions'], JSON_UNESCAPED_UNICODE),
        'image_path' => null,
        'image_url' => $figure['image'] ?? null,
        'enabled' => false,
        'sort_order' => $i,
        'created_at' => $now,
        'updated_at' => $now,
      ];
    }
    DB::table('compass_figures')->insert($rows);
  }

  public function down(): void
  {
    Schema::dropIfExists('compass_figures');
  }
};
