<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GuessWhoCategory extends Model
{
    use HasFactory;

    protected $table = 'guess_who_categories';

    protected $fillable = [
        'name_ar',
        'name_en',
        'slug',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function characters(): HasMany
    {
        return $this->hasMany(GuessWhoCharacter::class, 'category_id');
    }

    public function games(): HasMany
    {
        return $this->hasMany(GuessWhoGame::class, 'category_id');
    }
}
