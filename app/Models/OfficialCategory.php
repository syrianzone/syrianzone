<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OfficialCategory extends Model
{
    use HasFactory;

    protected $table = 'official_categories';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'label_ar',
        'label_en',
        'icon',
        'order_column',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'order_column' => 'integer',
    ];

    public function entities(): HasMany
    {
        return $this->hasMany(OfficialEntity::class, 'category_id', 'id')
            ->orderBy('order_column');
    }
}
