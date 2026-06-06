<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GuessWhoCharacter extends Model
{
    use HasFactory;

    protected $table = 'guess_who_characters';

    protected $fillable = [
        'category_id',
        'name_ar',
        'name_en',
        'image_path',
        'attributes',
        'is_active',
    ];

    protected $casts = [
        'attributes' => 'array',
        'is_active' => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(GuessWhoCategory::class, 'category_id');
    }
}
