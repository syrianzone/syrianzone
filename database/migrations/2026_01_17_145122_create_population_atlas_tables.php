<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pop_demographics', function (Blueprint $table) {
            $table->id();
            $table->string('data_type')->index();
            $table->integer('source_id')->index();
            $table->string('city_name');
            $table->integer('value');
            $table->string('source_url')->nullable();
            $table->date('date')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
        });

        Schema::create('pop_rainfall', function (Blueprint $table) {
            $table->id();
            $table->string('pcode')->index();
            $table->year('year');
            $table->float('rainfall');
            $table->float('rainfall_avg');
            $table->timestamps();
        });

        Schema::create('pop_environmental_log', function (Blueprint $table) {
            $table->id();
            $table->string('city_name')->unique();
            $table->float('lat');
            $table->float('lon');
            $table->bigInteger('population_ref')->nullable();
            $table->json('current_conditions');
            $table->json('forecast_summary');
            $table->json('climate_trends');
            $table->json('air_quality');
            $table->json('drought_risk');
            $table->json('historical_summary');
            $table->timestamp('last_updated_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pop_demographics');
        Schema::dropIfExists('pop_rainfall');
        Schema::dropIfExists('pop_environmental_log');
    }
};
