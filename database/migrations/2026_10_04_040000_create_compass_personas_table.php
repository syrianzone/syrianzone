<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void
  {
    // Admin-managed personas (spectra). One is chosen per run by the same
    // whitened distance the figures use, and its copy is shown on the result
    // page and the share image.
    Schema::create('compass_personas', function (Blueprint $table) {
      $table->id();
      $table->string('slug')->unique();          // stable id stored on results
      $table->string('name');
      $table->string('icon', 64)->nullable();    // lucide icon name
      $table->text('short')->nullable();         // ~30-word summary
      $table->json('stances');                   // string[]
      $table->text('factoid')->nullable();       // ~100-word historical note
      $table->json('center');                    // {axisId: number|null}
      $table->json('ranges')->nullable();        // {axisId: {min,max}} optional windows
      $table->boolean('enabled')->default(true);
      $table->unsignedInteger('sort_order')->default(0);
      $table->timestamps();

      $table->index(['enabled', 'sort_order']);
    });

    // Seed the built-in personas as ENABLED (the decision for this module),
    // in the migration so a fresh/test database has them without a seeder.
    $seed = require database_path('seeders/data/compass_personas.php');
    $now = now();
    $rows = [];
    foreach ($seed as $i => $persona) {
      $rows[] = [
        'slug' => $persona['id'],
        'name' => $persona['name'],
        'icon' => $persona['icon'],
        'short' => $persona['short'],
        'stances' => json_encode($persona['stances'], JSON_UNESCAPED_UNICODE),
        'factoid' => $persona['factoid'],
        'center' => json_encode($persona['center'], JSON_UNESCAPED_UNICODE),
        'ranges' => null,
        'enabled' => true,
        'sort_order' => $i,
        'created_at' => $now,
        'updated_at' => $now,
      ];
    }
    DB::table('compass_personas')->insert($rows);
  }

  public function down(): void
  {
    Schema::dropIfExists('compass_personas');
  }
};
