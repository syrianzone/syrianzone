<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class GovApp extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'gov_apps';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'name_ar',
        'description',
        'description_ar',
        'icon',
        'images',
        'links',
        'order_column',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'images' => 'array',
            'links' => 'array',
            'is_active' => 'boolean',
            'order_column' => 'integer',
        ];
    }
}
