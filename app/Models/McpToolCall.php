<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class McpToolCall extends Model
{
    protected $fillable = [
        'user_id',
        'token_id',
        'token_name',
        'tool',
        'arguments',
        'outcome',
        'error',
        'duration_ms',
        'ip',
        'user_agent',
    ];

    /**
     * Append-only: there is no updated_at, only created_at.
     */
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'arguments' => 'array',
            'duration_ms' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeDenied($query)
    {
        return $query->where('outcome', 'denied');
    }

    public function scopeForTool($query, string $tool)
    {
        return $query->where('tool', $tool);
    }
}
