<?php

namespace App\Models\Population;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PopulationRainfall extends Model
{
    use HasFactory;

    protected $table = 'pop_rainfall';

    protected $fillable = [
        'pcode',
        'year',
        'rainfall',
        'rainfall_avg',
    ];

    protected $casts = [
        'year' => 'integer',
        'rainfall' => 'float',
        'rainfall_avg' => 'float',
    ];
}
