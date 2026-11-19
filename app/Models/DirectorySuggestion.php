<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DirectorySuggestion extends Model
{
    public const MODULES = ['govtcvs', 'syofficial', 'govapps', 'phonebook'];

    public const KINDS = ['add', 'edit'];

    public const STATUSES = ['pending', 'accepted', 'dismissed'];

    protected $fillable = [
        'module',
        'kind',
        'target_id',
        'target_label',
        'title',
        'payload',
        'details',
        'source_url',
        'user_id',
        'status',
        'reviewed_by',
        'reviewed_at',
        'resolution_note',
    ];

    protected $casts = [
        'payload' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function scopeForModule(Builder $query, string $module): Builder
    {
        return $query->where('module', $module);
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', 'pending');
    }
}
