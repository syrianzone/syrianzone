<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * A character/personality on the compass: its position vector on the numeric
 * axes, its foreign-alignment bloc(s), and the portrait it renders.
 *
 * Rows are admin-managed and DISABLED by default; the compass page is handed
 * only the enabled ones, so an operator chooses the roster deliberately.
 */
class CompassFigure extends Model
{
    /** @var array<int, string> */
    public const CATEGORIES = ['founder', 'baath', 'islam', 'civ', 'kurd', 'minority', 'current'];

    protected $fillable = [
        'name',
        'category',
        'align',
        'positions',
        'image_path',
        'image_url',
        'enabled',
        'sort_order',
    ];

    protected $casts = [
        'positions' => 'array',
        'enabled' => 'boolean',
        'sort_order' => 'integer',
    ];

    /** @param  Builder<CompassFigure>  $query */
    public function scopeEnabled(Builder $query): Builder
    {
        return $query->where('enabled', true);
    }

    /** The shape the client engine expects (mirrors data/figures.ts). */
    public function toFigurePayload(): array
    {
        return [
            'name' => $this->name,
            'category' => $this->category,
            'align' => $this->align,
            'positions' => $this->positions ?? [],
            'image' => $this->image_url ?: null,
        ];
    }

    /** The shape the admin CRUD UI expects. */
    public function toAdminPayload(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'category' => $this->category,
            'align' => $this->align,
            'positions' => $this->positions ?? [],
            'imagePath' => $this->image_path,
            'imageUrl' => $this->image_url,
            'enabled' => (bool) $this->enabled,
            'sortOrder' => (int) $this->sort_order,
        ];
    }
}
