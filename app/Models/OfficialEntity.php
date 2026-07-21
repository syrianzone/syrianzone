<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfficialEntity extends Model
{
    use HasFactory;

    protected $table = 'official_entities';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'category_id',
        'name',
        'name_ar',
        'description',
        'description_ar',
        'image',
        'socials',
        'order_column',
        'is_active',
    ];

    protected $casts = [
        'socials' => 'array',
        'is_active' => 'boolean',
        'order_column' => 'integer',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(OfficialCategory::class, 'category_id', 'id');
    }
}
