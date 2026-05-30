<?php

namespace App\Models\Population;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PopulationDemographic extends Model
{
    use HasFactory;

    protected $table = 'pop_demographics';

    protected $fillable = [
        'data_type',
        'source_id',
        'city_name',
        'value',
        'source_url',
        'date',
        'note',
    ];

    protected $casts = [
        'date' => 'date',
    ];
}
