<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * A persona (spectrum): the umbrella label a finished compass run resolves to.
 *
 * Chosen by the same whitened distance the figures use, against `center`, with
 * optional `ranges` acting as per-axis windows that filter out personas whose
 * window the run's score does not fall inside. `slug` is the stable id written
 * onto a result and read back by the stats page.
 */
class CompassPersona extends Model
{
    protected $fillable = [
        'slug',
        'name',
        'icon',
        'short',
        'stances',
        'factoid',
        'center',
        'ranges',
        'enabled',
        'sort_order',
    ];

    protected $casts = [
        'stances' => 'array',
        'center' => 'array',
        'ranges' => 'array',
        'enabled' => 'boolean',
        'sort_order' => 'integer',
    ];

    /** @param  Builder<CompassPersona>  $query */
    public function scopeEnabled(Builder $query): Builder
    {
        return $query->where('enabled', true);
    }

    /** The shape the client engine expects (mirrors data/spectra.ts). */
    public function toPersonaPayload(): array
    {
        return [
            'id' => $this->slug,
            'name' => $this->name,
            'icon' => $this->icon ?? 'Shield',
            'short' => $this->short ?? '',
            'stances' => $this->stances ?? [],
            'factoid' => $this->factoid ?? '',
            'center' => $this->center ?? [],
            'ranges' => $this->ranges ?? [],
        ];
    }

    /** The shape the admin CRUD UI expects. */
    public function toAdminPayload(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'icon' => $this->icon,
            'short' => $this->short,
            'stances' => $this->stances ?? [],
            'factoid' => $this->factoid,
            'center' => $this->center ?? [],
            'ranges' => $this->ranges ?? [],
            'enabled' => (bool) $this->enabled,
            'sortOrder' => (int) $this->sort_order,
        ];
    }
}
