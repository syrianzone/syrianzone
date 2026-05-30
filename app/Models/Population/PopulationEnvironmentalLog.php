<?php

namespace App\Models\Population;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PopulationEnvironmentalLog extends Model
{
    use HasFactory;

    protected $table = 'pop_environmental_log';

    protected $fillable = [
        'city_name',
        'lat',
        'lon',
        'population_ref',
        'current_conditions',
        'forecast_summary',
        'climate_trends',
        'air_quality',
        'drought_risk',
        'historical_summary',
        'last_updated_at',
    ];

    protected $casts = [
        'lat' => 'float',
        'lon' => 'float',
        'population_ref' => 'integer',
        'current_conditions' => 'array',
        'forecast_summary' => 'array',
        'climate_trends' => 'array',
        'air_quality' => 'array',
        'drought_risk' => 'array',
        'historical_summary' => 'array',
        'last_updated_at' => 'datetime',
    ];
}
