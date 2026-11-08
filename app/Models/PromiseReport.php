<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Public input on a published promise: new progress/evidence, or an error. */
class PromiseReport extends Model
{
    public const KINDS = ['progress', 'error'];

    public const STATUSES = ['pending', 'accepted', 'dismissed'];

    protected $fillable = [
        'promise_id', 'user_id', 'kind', 'body', 'source_url', 'status',
        'reviewed_by', 'reviewed_at', 'resolution_note',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    public function promise(): BelongsTo
    {
        return $this->belongsTo(Promise::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
