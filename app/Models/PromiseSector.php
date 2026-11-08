<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Editor-managed promise sector (electricity, housing, …). */
class PromiseSector extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'label', 'icon', 'order_column', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
        'order_column' => 'integer',
    ];

    public function promises(): HasMany
    {
        return $this->hasMany(Promise::class, 'sector_id');
    }

    /** @param  Builder<PromiseSector>  $query */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /** @return array{id: string, label: string, icon: string|null} */
    public function toOption(): array
    {
        return ['id' => $this->id, 'label' => $this->label, 'icon' => $this->icon];
    }
}
