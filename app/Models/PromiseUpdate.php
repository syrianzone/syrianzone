<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One entry in a promise's public change log: a progress reading, a status
 * change, an official response, or an editor's note.
 */
class PromiseUpdate extends Model
{
    public const TYPES = ['progress', 'status_change', 'official_response', 'note'];

    /** Entry types that must cite a source. */
    public const SOURCED_TYPES = ['progress', 'status_change', 'official_response'];

    protected $fillable = [
        'promise_id', 'type', 'happened_on', 'body', 'status_from', 'status_to',
        'value', 'source_url', 'archive_url', 'created_by',
    ];

    protected $casts = [
        'happened_on' => 'date:Y-m-d',
        'value' => 'float',
    ];

    public function promise(): BelongsTo
    {
        return $this->belongsTo(Promise::class);
    }

    /** @return array<string, mixed> */
    public function toPayload(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'happenedOn' => $this->happened_on?->format('Y-m-d'),
            'body' => $this->body,
            'statusFrom' => $this->status_from,
            'statusTo' => $this->status_to,
            'value' => $this->value,
            'sourceUrl' => $this->source_url,
            'archiveUrl' => $this->archive_url,
        ];
    }
}
