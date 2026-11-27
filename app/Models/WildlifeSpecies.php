<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One species of the wildlife guide. `record` is the published record (null
 * until first published), `draft` an edit awaiting `wildlife.publish`; both
 * have the shape of a species in resources/data/wildlife.json.
 *
 * @property int $id
 * @property string $slug
 * @property int $position
 * @property array<string, mixed>|null $record
 * @property array<string, mixed>|null $draft
 * @property bool $is_hidden
 * @property int $version
 */
class WildlifeSpecies extends Model
{
    protected $table = 'wildlife_species';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'record' => 'array',
            'draft' => 'array',
            'is_hidden' => 'boolean',
            'position' => 'integer',
            'version' => 'integer',
            'draft_updated_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    /** Shown on the public pages: published and not hidden. */
    public function isPublic(): bool
    {
        return $this->record !== null && ! $this->is_hidden;
    }

    /** draft (never published), published, or hidden (published, then unpublished). */
    public function state(): string
    {
        return match (true) {
            $this->record === null => 'draft',
            $this->is_hidden => 'hidden',
            default => 'published',
        };
    }

    public function draftAuthor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'draft_updated_by');
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }
}
